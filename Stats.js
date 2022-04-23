const CONSTANTS = require('./../../Util/CONSTANTS.js');
const TWITCHIRC = require('./../../Modules/TwitchIRC.js');
const BTTV = require('./../../3rdParty/BTTV.js');
const FFZ = require('./../../3rdParty/FFZ.js');

const express = require('express');
const fs = require('fs');
const path = require('path');
const Datastore = require('nedb');

const PACKAGE_DETAILS = {
    name: "Stats",
    description: "Twitch Chat Stats displayed in a neat an easy way.",
    picture: "/images/icons/chart-bar.svg"
};

class Stats extends require('./../../Util/PackageBase.js').PackageBase {
    constructor(webappinteractor, twitchirc, twitchapi, logger) {
        super(PACKAGE_DETAILS, webappinteractor, twitchirc, twitchapi, logger);

        this.Config.AddSettingTemplates([
            { name: 'Data_Dir', type: 'string', default: CONSTANTS.FILESTRUCTURE.PACKAGES_INSTALL_ROOT + 'Stats/data/' },
            { name: 'debug', type: 'boolean', default: false }
        ]);
        this.Config.Load();
        this.Config.FillConfig();
    }

    async Init(startparameters) {
        if (!this.isEnabled()) return Promise.resolve();

        let cfg = this.Config.GetConfig();

        //DataDir exists
        try {
            if (!fs.existsSync(path.resolve(cfg['Data_Dir']))) {
                fs.mkdirSync(path.resolve(cfg['Data_Dir']));
            }
        } catch (err) {
            this.Logger.error(err.message);
        }

        this.CURRENT_STREAM_DATA = null;

        //General Datasets
        this.Datasets = [];

        //Twitch Chat Listener
        this.TwitchIRC.on('join', (channel, username, self) => this.Join(username));
        this.TwitchIRC.on('chat', async (channel, userstate, message, self) => this.MessageEventHandler(channel, userstate, message, self).catch(err => this.Logger.error(err.message)));
        //this.TwitchIRC.on('anongiftpaidupgrade', (channel, username, userstate) => this.Upgrade({});
        //this.TwitchIRC.on('giftpaidupgrade', (channel, username, sender, userstate) => this.Upgrade({}));
        //this.TwitchIRC.on('primepaidupgrade', (channel, username, methods, userstet) => this.Upgrade({}));
        this.TwitchIRC.on('subscription', (channel, username, method, message, userstate) => this.Sub({
            user_id: userstate['user-id'],
            user_login: userstate['login'],
            user_name: userstate['display-name'],
            tier: method.plan,
            is_gift: false
        }));
        this.TwitchIRC.on('resub', (channel, username, months, message, userstate, methods) => this.ReSub({
            user_id: userstate['user-id'],
            user_login: userstate['login'],
            user_name: userstate['display-name'],
            tier: methods.plan,
            message: { text: message, emotes: this.ConvertIRCEmotesToEventSubEmotes(userstate['emotes']) },
            cumulative_months: parseInt(userstate["msg-param-cumulative-months"] || "0"),
            streak_months: months === 0 ? null : months,
            duration_months: 1
        }));
        this.TwitchIRC.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => this.GiftSub({
            user_id: userstate['user-id'],
            user_login: userstate['login'],
            user_name: userstate['display-name'],
            target_id: userstate['msg-param-recipient-id'],
            target_login: userstate['msg-param-recipient-user-name'],
            target_name: userstate['msg-param-recipient-display-name'],
            tier: methods.plan,
            is_anonymous: username === 'AnAnonymousGifter'
        }));
        this.TwitchIRC.on('submysterygift', (channel, username, numbOfSubs, methods, userstate) => this.GiftBomb({
            user_id: userstate['user-id'],
            user_login: userstate['login'],
            user_name: userstate['display-name'],
            total: numbOfSubs,
            tier: methods.plan,
            cumulative_total: parseInt(userstate["msg-param-sender-count"] || "0"),
            is_anonymous: username === 'AnAnonymousGifter'
        }));
        this.TwitchIRC.on('cheer', (channel, userstate, message) => this.Cheer({
            user_id: userstate['user-id'],
            user_login: userstate['username'],
            user_name: userstate['display-name'],
            bits: userstate['bits'],
            message: message,
            is_anonymous: userstate['username'] === 'AnAnonymousGifter'
        }));
        this.TwitchIRC.on('hosted', (channel, username, viewers, autohost, userstate) => this.Host({
            from_broadcaster_user_id: userstate['user-id'],
            from_broadcaster_user_login: userstate['login'] || username,
            from_broadcaster_user_name: userstate['display-name'] || username,
            viewers,
            autohost
        }));
        this.TwitchIRC.on('raided', (channel, username, viewers, userstate) => this.Raid({
            from_broadcaster_user_id: userstate['user-id'],
            from_broadcaster_user_login: userstate['login'],
            from_broadcaster_user_name: userstate['display-name'],
            viewers: viewers
        }));
        
        //Updating Static Information
        this.CACHED_FFZ_ROOM = null;
        this.CACHED_BTTV_EMOTES = null;
        this.CACHED_TOP_USER_IMAGES = {};

        //Custom - Datasets
        this.RAW_DB = new Datastore({ filename: this.GetDatabasePath('raw'), autoload: true });
        this.USERS_DB = new DATABASE(this.GetDatabasePath('users'), USER, 'user_id', [EVENT_IDENTIFIER.CHAT]);
        
        //WebHooks
        this.TwitchAPI.AddEventSubCallback('all', this.getName(), (body) => this.EVENTSUB_CALLBACK(body).catch(err => this.Logger.error(err.message)));

        //API
        let APIRouter = express.Router();

        //Misc
        APIRouter.get('/navigation', async (req, res, next) => {
            let users = [];

            try {
                users = await this.USERS_DB.GetValue({}, this.GetPaginationString(5, 0, { customsort: 'messages' }));
                users = users.data;
                for (let user of users) delete user['_id'];
            } catch (err) {

            }

            res.json({ users });
        });
        APIRouter.get('/pages/overview', async (req, res, next) => {
            let users = [];

            try {
                users = await this.USERS_DB.GetValue({}, this.GetPaginationString(3, 0, { customsort: 'messages' }));
                users = users.data;
                for (let user of users) delete user['_id'];
            } catch (err) {

            }

            //Find Users Image and Cache them
            let user_ids = [];
            let user_logins = [];
            for (let user of users) if (user.user_id && !this.CACHED_TOP_USER_IMAGES[user.user_id]) user_ids.push(user.user_id);
            for (let user of users) if (user.user_id === undefined && !this.CACHED_TOP_USER_IMAGES[user.user_login]) user_logins.push(user.user_login);
            
            if (user_ids.length > 0) {
                try {
                    let ttv_users = await this.TwitchAPI.GetUsers({ id: user_ids, login: user_logins });
                    
                    for (let user of ttv_users.data) {
                        let DB_user = users.find(elt => elt.user_login === user.login);
                        if (DB_user.user_id === undefined) this.CACHED_TOP_USER_IMAGES[user.login] = user.profile_image_url;
                        else this.CACHED_TOP_USER_IMAGES[user.id] = user.profile_image_url;
                    }
                } catch (err) {

                }
            }
            
            //Add Cached Images
            for (let user of users) {
                user.img = this.CACHED_TOP_USER_IMAGES[user.user_id || user.user_login];
            }

            res.json({ users });
        });

        this.setAPIRouter(APIRouter);
        
        this.SETUP_COMPLETE = true;
        return this.reload();
    }
    async reload() {
        if (!this.isEnabled()) return Promise.reject(new Error("Package is disabled!"));

        try {
            await this.updateStreamInformation();
        } catch (err) {

        }

        try {
            await this.updateThirdPartyEmotes();
        } catch (err) {

        }

        this.Logger.info("Stats (Re)Loaded!");
        return Promise.resolve();
    }

    async EVENTSUB_CALLBACK(body) {
        let type = body.subscription.type;

        //GENERAL EVENT HANDLING
        try {
            if (type === 'channel.update') await this.Channel_Update(body.event);
            else if (type === 'stream.offline') await this.Channel_Offline(body.event);
        } catch (err) {

        }

        //Update Streamdata
        try {
            await this.updateStreamInformation();
        } catch (err) {
            return Promise.reject(err);
        }

        try {
            if (type === 'channel.follow') await this.Follow(body.event);
            else if (type === 'channel.subscribe') await this.Sub(body.event);
            else if (type === 'channel.subscription.gift') await this.GiftBomb(body.event);
            else if (type === 'channel.subscription.message') await this.ReSub(body.event);
            else if (type === 'channel.cheer') await this.Cheer(body.event);
            else if (type === 'channel.raid') await this.Raid(body.event);
            else if (type === 'channel.ban') await this.Moderator_Ban(body.event);
            else if (type === 'channel.unban') await this.Moderator_Unban(body.event);
            else if (type === 'channel.moderator.add') await this.Moderator_Add(body.event);
            else if (type === 'channel.moderator.remove') await this.Moderator_Remove(body.event);
            else if (type === 'channel.channel_points_custom_reward_redemption.add') await this.ChannelPoint_Add(body.event);
            else if (type === 'channel.channel_points_custom_reward_redemption.update') await this.ChannelPoint_Update(body.event);
            else if (type === 'channel.poll.end') await this.Poll_End(body.event);
            else if (type === 'channel.prediction.end') await this.Prediction_End(body.event);
            else if (type === 'channel.hype_train.begin') this.HypeTrain_Begin(body.event);
            else if (type === 'channel.hype_train.progress') this.HypeTrain_Progress(body.event);
            else if (type === 'channel.hype_train.end') await this.HypeTrain_End(body.event);
            else if (type === 'stream.online') await this.Channel_Online(body.event);
        } catch (err) {

        }

        return Promise.resolve();
    }
    async updateStreamInformation() {
        let channel = this.TwitchIRC.getChannel(true);

        //Get Streams
        try {
            let streams = await this.TwitchAPI.GetStreams({ user_login: channel });
            this.CURRENT_STREAM_DATA = streams.data[0];
            return Promise.resolve(this.CURRENT_STREAM_DATA);
        } catch (err) {
            this.CURRENT_STREAM_DATA = null;
            return Promise.resolve(null);
        }
    }
    async updateThirdPartyEmotes() {
        //FFZ
        try {
            this.CACHED_FFZ_ROOM = await FFZ.GetRoomByName(this.TwitchIRC.getChannel(true), true);
        } catch (err) {

        }

        //Get Room ID
        let room_id = null;
        try {
            room_id = (await this.TwitchAPI.GetUsers({ login: this.TwitchIRC.getChannel(true) }))[0].id;
        } catch (err) {

        }
        if (room_id === null) return Promise.resolve();

        //BTTV
        try {
            this.CACHED_BTTV_EMOTES = await BTTV.GetChannelEmotes(room_id, true);
        } catch (err) {

        }

        return Promise.resolve();
    }
    
    //////////////////////////////////////////////////////////////////////
    //                      Chat / EventSub Triggers
    //////////////////////////////////////////////////////////////////////

    //Chat
    async Join(username) {
        //Add 2 Raw
        try {
           // this.RAW_DB.insert({ type: EVENT_IDENTIFIER.JOIN, data: { username } });
        } catch (err) {

        }
    }
    async MessageEventHandler(channel, userstate, message, self) {
        let messageObj = new TWITCHIRC.Message(channel, userstate, message);

        if (self) {
            //MAYBE IN THE FUTURE BOT STATS ARE TRACKED TOO
            let emote_sets = this.TwitchIRC.GetAvailableEmotes();

            try {
                await messageObj.ExtractTTVEmotes(this.TwitchAPI, emote_sets);
                //Add Badges in future when available with custom TTV IRC
                messageObj.userstate['badges']['twitchbot'] = '1';
            } catch (err) {
                console.log(err);
            }
        }

        /////////////////////////
        //    ANALYSE MESSAGE
        /////////////////////////

        let json = messageObj.toJSON();
        let message_stats = {
            'message_id': json['id'],
            'badge-info': json['badge-info'],
            'badges': json['badges'],
            'color': json['color'],
            'user_id': json['user-id'],
            'user_login': json['username'],
            'user_name': json['display-name'],
            'emotes_ttv': json['emotes'],
            'emotes_bttv': null,
            'emotes_ffz': null,
            'room-id': json['room-id'],
            'message': json['Message'],
            'time': parseInt(json['tmi-sent-ts'])
        };

        try {
            message_stats['emotes_bttv'] = await messageObj.getBTTVEmotes(this.CACHED_BTTV_EMOTES);
        } catch (err) {

        }

        try {
            message_stats['emotes_ffz'] = await messageObj.getFFZEmotes(this.CACHED_FFZ_ROOM);
        } catch (err) {

        }
        
        //Overpower TTV over FFZ over BTTV
        let ttv_emote_names = [];
        for (let emote_id in message_stats.emotes_ttv || {}) {
            let place = userstate.emotes[emote_id][0];
            let begin = parseInt(place.split('-')[0]);
            let end = parseInt(place.split('-')[1]);
            ttv_emote_names.push(message.substring(begin, end));
        }

        let ffz_emote_names = [];
        for (let emote_id in message_stats['emotes_ffz'] || {}) {
            let place = message_stats['emotes_ffz'][emote_id][0];
            let begin = parseInt(place.split('-')[0]);
            let end = parseInt(place.split('-')[1]);

            let name = message.substring(begin, end);
            ffz_emote_names.push(name);
            if (ttv_emote_names.find(elt => elt === name)) delete message_stats['emotes_ffz'][emote_id];
        }

        for (let emote_id in message_stats['emotes_bttv'] || {}) {
            let place = message_stats['emotes_bttv'][emote_id][0];
            let begin = parseInt(place.split('-')[0]);
            let end = parseInt(place.split('-')[1]);

            let name = message.substring(begin, end);

            if (ffz_emote_names.find(elt => elt === name)) delete message_stats['emotes_bttv'][emote_id];
        }

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.CHAT, data: message_stats });
        } catch (err) {
            console.log(err);
        }

        return Promise.resolve();
    }

    //Streams
    async Channel_Update(event) {
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.CHANNEL.UPDATE, data: event });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Channel_Online(event) {
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.CHANNEL.ONLINE, data: event });
        } catch (err) {

        }
        return Promise.resolve();
    }
    async Channel_Offline(event) {
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.CHANNEL.OFFLINE, data: event });
        } catch (err) {

        }
    }

    //Moderator Actions
    async Moderator_Add(event) {
        //Update Moderator Actions Database
        let moderation_stats = {
            type: 'mod',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };
        
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.MODERATOR.ADD, data: moderation_stats });
        } catch (err) {

        }
    }
    async Moderator_Remove(event) {
        //Update Moderator Actions Database
        let moderation_stats = {
            type: 'unmod',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };
        
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.MODERATOR.REMOVE, data: moderation_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Moderator_Ban(event) {
        //Update Moderator Actions Database
        let moderation_stats = {
            type: event['is_permanent'] ? 'ban' : 'timeout',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            moderator_user_id: event['user_id'],
            moderator_user_login: event['user_login'],
            moderator_user_name: event['user_name'],
            reason: event['reason'],
            ends_at: event['ends_at'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.MODERATOR.BAN, data: moderation_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Moderator_Unban(event) {
        //Update Moderator Actions Database
        let moderation_stats = {
            type: 'unban',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            moderator_user_id: event['user_id'],
            moderator_user_login: event['user_login'],
            moderator_user_name: event['user_name'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.MODERATOR.UNBAN, data: moderation_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }

    //Subs/Follows/Cheers/Raids/Hosts
    async Follow(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'follow',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            stream_id: this.GetCurrentStreamID(),
            time: this.DateToNumber(event['followed_at'])
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.FOLLOW, data: sub_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Sub(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'sub',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            tier: event['tier'],
            is_gift: event['is_gift'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.SUB, data: sub_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async ReSub(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'resub',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            tier: event['tier'],
            message: event['message'],
            cumulative_months: event['cumulative_months'],
            streak_months: event['streak_months'],
            duration_months: event['duration_months'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };
        
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.RESUB, data: sub_stats });
        } catch (err) {

        }
        
        return Promise.resolve();
    }
    async GiftBomb(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'giftbomb',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            total: event['total'],
            tier: event['tier'],
            cumulative_total: event['cumulative_total'],
            is_anonymous: event['is_anonymous'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.SUBBOMB, data: sub_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async GiftSub(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'giftsub',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            target_id: event['target_id'],
            target_login: event['target_login'],
            target_name: event['target_name'],
            tier: event['tier'],
            is_anonymous: event['is_anonymous'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.SUBGIFT, data: sub_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Cheer(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'cheer',
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            bits: event['bits'],
            message: event['message'],
            is_anonymous: event['is_anonymous'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.CHEER, data: sub_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Raid(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'raid',
            from_broadcaster_user_id: event['from_broadcaster_user_id'],
            from_broadcaster_user_login: event['from_broadcaster_user_login'],
            from_broadcaster_user_name: event['from_broadcaster_user_name'],
            viewers: event['viewers'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.RAID, data: sub_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Host(event) {
        //Update Sub Actions Database
        let sub_stats = {
            type: 'host',
            from_broadcaster_user_id: event['from_broadcaster_user_id'],
            from_broadcaster_user_login: event['from_broadcaster_user_login'],
            from_broadcaster_user_name: event['from_broadcaster_user_name'],
            viewers: event['viewers'],
            autohost: event['autohost'],
            stream_id: this.GetCurrentStreamID(),
            time: Date.now()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.HOST, data: sub_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }

    //Channel Events
    HypeTrain_Begin(event) {
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.HYPETRAIN.BEGIN, data: event });
        } catch (err) {

        }
    }
    HypeTrain_Progress(event) {
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.HYPETRAIN.PROGRESS, data: event });
        } catch (err) {

        }
    }
    async HypeTrain_End(event) {
        //Update Channel Event Database
        let event_stats = {
            type: 'hypetrain',
            id: event['id'],
            level: event['level'],
            total: event['total'],
            top_contributions: event['top_contributions'],
            started_at: event['started_at'],
            ended_at: event['ended_at'],
            cooldown_ends_at: event['cooldown_ends_at'],
            stream_id: this.GetCurrentStreamID()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.HYPETRAIN.END, data: event_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Prediction_End(event) {
        if (event['status'] === 'cancled') return Promise.resolve();

        //Update Channel Event Database
        let event_stats = {
            type: 'prediction',
            id: event['id'],
            title: event['title'],
            winning_outcome_id: event['winning_outcome_id'],
            outcomes: event['outcomes'],
            started_at: event['started_at'],
            ended_at: event['ended_at'],
            stream_id: this.GetCurrentStreamID()
        };

        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.PREDICTION.END, data: event_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async Poll_End(event) {
        //Update Channel Event Database
        let event_stats = {
            type: 'poll',
            id: event['id'],
            title: event['title'],
            choices: event['choices'],
            bits_voting: event['bits_voting'],
            channel_points_voting: event['channel_points_voting'],
            started_at: event['started_at'],
            ended_at: event['ended_at'],
            stream_id: this.GetCurrentStreamID()
        };
        
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.POLL.END, data: event_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async ChannelPoint_Add(event) {
        //Update Channel Event Database
        let event_stats = {
            type: 'channel_point_redeemed',
            id: event['id'],
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            user_input: event['user_input'],
            status: event['status'],
            reward: event['reward'],
            redeemed_at: this.DateToNumber(event['redeemed_at']),
            stream_id: this.GetCurrentStreamID()
        };
        
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.CHANNELPOINT_CUSTOM_REDEMPTION.ADD, data: event_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    async ChannelPoint_Update(event) {
        //Update Channel Event Database
        let event_stats = {
            type: 'channel_point_redeemed',
            id: event['id'],
            user_id: event['user_id'],
            user_login: event['user_login'],
            user_name: event['user_name'],
            user_input: event['user_input'],
            status: event['status'],
            reward: event['reward'],
            redeemed_at: this.DateToNumber(event['redeemed_at']),
            stream_id: this.GetCurrentStreamID()
        };
        
        //Add 2 Raw
        try {
            this.RAW_DB.insert({ type: EVENT_IDENTIFIER.CHANNELPOINT_CUSTOM_REDEMPTION.UPDATE, data: event_stats });
        } catch (err) {

        }

        return Promise.resolve();
    }
    
    //////////////////////////////////////////////////////////////////////
    //                      UTIL
    //////////////////////////////////////////////////////////////////////

    GetDatabasePath(name) {
        let cfg = this.Config.GetConfig();
        return path.resolve(cfg['Data_Dir'] + name + '.db');
    }
    GetCurrentStreamID() {
        if (this.CURRENT_STREAM_DATA) return this.CURRENT_STREAM_DATA.id;
        let cfg = this.Config.GetConfig();
        if (cfg['debug']) return 'debug';
        return null;
    }
}

//V2
const EVENT_IDENTIFIER = {
    JOIN: 'join',
    FOLLOW: 'follow',
    CHAT: 'chat',
    SUB: 'sub',
    RESUB: 'resub',
    SUBGIFT: 'subgift',
    SUBBOMB: 'subbomb',
    CHEER: 'cheer',
    HOST: 'host',
    RAID: 'raid',
    CHANNEL: {
        UPDATE: 'channel.update',
        ONLINE: 'channel.online',
        OFFLINE: 'channel.offline'
    },
    MODERATOR: {
        ADD: 'channel.moderator.add',
        REMOVE: 'channel.moderator.remove',
        BAN: 'channel.moderator.ban',
        UNBAN: 'channel.moderator.unban'
    },
    HYPETRAIN: {
        BEGIN: 'channel.hype_train.begin',
        PROGRESS: 'channel.hype_train.progress',
        END: 'channel.hype_train.end'
    },
    POLL: {
        BEGIN: 'channel.poll.begin',
        PROGRESS: 'channel.poll.progress',
        END: 'channel.poll.end'
    },
    PREDICTION: {
        BEGIN: 'channel.prediction.begin',
        PROGRESS: 'channel.prediction.progress',
        END: 'channel.prediction.end'
    },
    CHANNELPOINT_CUSTOM_REDEMPTION: {
        ADD: 'channel.channel_points_custom_reward_redemption.add',
        UPDATE: 'channel.channel_points_custom_reward_redemption.update'
    }
};

class DATAPOINT {
    constructor(name, value) {
        this.name = name || "";
        this.value = value || null;
    }

    on(event, data) {
        return this.value;
    }
    GetValue() {
        return this.value;
    }
    GetName() {
        return this.name;
    }
}
class DATAPOINT_FUNCTION {
    constructor(name, value, update_func = (dp, event, data) => dp.value) {
        this.name = name || "";
        this.value = value || null;
        this.update_func = update_func;
    }

    on(event, data) {
        this.update_func(this, event, data);
        return this.value;
    }
}
class DATAPOINT_SIMPLE extends DATAPOINT {
    constructor(name, value, events = [], alias) {
        super(name, value);
        this.events = events;
        this.alias = alias;
    }

    on(event, data) {
        if (this.events.length > 0 && !this.events.find(elt => elt === event)) return this.value;
        if (this.alias) this.value = data[this.alias];
        else this.value = data[this.name];
        return this.value;
    }
}
class DATAPOINT_INCREMENT extends DATAPOINT {
    constructor(name, value, events = []) {
        super(name, value);
        this.events = events;
    }

    on(event, data) {
        if (this.events.length > 0 && !this.events.find(elt => elt === event)) return this.value;
        this.value++;
        return this.value;
    }
}

class DATAPOOL extends DATAPOINT {
    constructor(name, value = [], DATASET, key, events = []) {
        super(name, 'user GetValue() instead');
        this.key = key;
        this.datasets = [];
        this.DATASET = DATASET;
        this.events = events;

        //Preset values
        for (let entry of value) {
            this.datasets.push(new (this.DATASET)(entry));
        }
    }

    on(event, data) {
        if (this.events.length > 0 && !this.events.find(elt => elt === event)) return this.value;

        //Dataset exists
        let ds = this.datasets.find(elt => elt.GetName() === data[this.key]);

        //Create New
        if (!ds) {
            ds = new (this.DATASET)();
            let value = ds.on(event, data);
            this.datasets.push(ds);
            return value;
        }

        //Update Old
        return ds.on(event, data);
    }

    GetValue() {
        let value = {};
        for (let ds of this.datasets) {
            value[ds.GetName()] = ds.GetValue();
        }
        return value;
    }
}

class DATASET {
    constructor(name, preload = {}) {
        this.name = name;
        this.datapoints = [];
    }
    GetName() {
        return this.name;
    }
    GetValue() {
        let value = {};
        for (let dp of this.datapoints) {
            value[dp.GetName()] = dp.GetValue();
        }
        return value;
    }

    on(event, data) {
        let value = {};
        for (let dp of this.datapoints) {
            value[dp.name] = dp.on(event, data);
        }
        return value;
    }
}
class USER extends DATASET {
    constructor(preload = {}) {
        super(preload['user_id'] || 'NaN', preload);

        this.datapoints = [
            new DATAPOINT_SIMPLE('user_id', preload['user_id'] || 'NaN'),
            new DATAPOINT_SIMPLE('user_login', preload['user_login']),
            new DATAPOINT_SIMPLE('user_name', preload['user_name']),
            new DATAPOINT_INCREMENT('messages', preload['messages'])
            //Emote count - Requieres Emote Structure Update
            //Emotes - Requieres Emote Structure Update
            //Streams
            //Badges - Requieres Badge Collection Update
            //Games
            //Predictions
            //HypeTrains
            //Resubs / Cheers / etc.
        ];
    }
}

//Requieres Emote Structure Update
class USER_EMOTE extends DATASET {
    constructor(preload = {}) {
        super(preload['emote_id'] || 'NaN', preload);

        this.datapoints = [
            new DATAPOINT_SIMPLE('emote_id', preload['emote_id'] || 'NaN'),
            new DATAPOINT_SIMPLE('emote_name', preload['emote_name']),
            new DATAPOINT_SIMPLE('is_ttv', preload['is_ttv']),
            new DATAPOINT_SIMPLE('is_bttv', preload['is_bttv']),
            new DATAPOINT_SIMPLE('is_ffz', preload['is_ffz'])
            //Count
            //Users
            //Streams
        ];
    }
}

class DATABASE extends DATAPOOL {
    constructor(path, DATASET, key, events = []) {
        super(path, 'use GetValue(query, pagination) instead', DATASET, key, events);
        this.datastore = new Datastore({ filename: path, autoload: true });
    }

    async on(event, data) {
        if (this.events.length > 0 && !this.events.find(elt => elt === event)) return this.value;

        //Get Corrent Dataset
        let ds = null;
        try {
            let db_data = await this.GetValue({ [this.key]: data[this.key] });
            ds = new (this.DATASET)(db_data[0]);
        } catch (err) {
            return Promise.reject(err);
        }

        let value = null;

        //Create New
        if (!ds) {
            ds = new (this.DATASET)();
            this.datasets.push(ds);
        }

        //Update Dataset
        value = ds.on(event, data);

        //Update DB
        return this.SetValue({ [this.key]: value[this.key] }, value);
    }
    async onMass(event_list = []) {
        //Get Corrent Datasets
        let dss = [];
        try {
            let db_data = await this.GetValue();
            for (let ds of db_data) dss.push(new (this.DATASET)(ds));
        } catch (err) {
            return Promise.reject(err);
        }

        let to_update = {};
        let eventnum = {};
        
        //Go through all Events
        for (let event of event_list) {
            if (event.type === 'message') event = { type: 'chat', data: event.message_stats };

            if (this.events.length > 0 && !this.events.find(elt => elt === event.type)) continue;

            let value = {};
            //Find targeted Dataset
            let ds = dss.find(elt => elt.GetName() === event.data[this.key]);
            
            //Create New
            if (!ds) {
                ds = new (this.DATASET)(event.data);
                dss.push(ds);
            }

            //Update Dataset
            value = ds.on(event.type, event.data);

            //Add to Update List
            to_update[value[this.key]] = value;
            if (!eventnum[value[this.key]]) eventnum[value[this.key]] = 1;
            else eventnum[value[this.key]]++;
        }
        
        //Update DB
        for (let update in to_update) {
            try {
                let value = await this.SetValue({ [this.key]: update }, to_update[update]);
            } catch (err) {
                console.log(err);
            }
        }
    }

    async SetValue(query = {}, value = {}) {
        return new Promise((resolve, reject) => {
            this.datastore.update(query, value, { upsert: true }, (err, num, upsert) => {
                if (err) reject(new Error(err));
                else resolve(value);
            });
        });
    }
    async GetValue(query = {}, pagination) {
        return this.AccessNeDB(this.datastore, query, pagination);
    }

    //Imported from UTIL
    async AccessNeDB(datastore, query = {}, pagination) {
        if (!datastore) return Promise.resolve([]);

        return new Promise((resolve, reject) => {
            datastore.find(query, (err, docs) => {
                if (err) {
                    reject(err);
                } else {
                    if (pagination) {
                        let pages = this.GetPaginationValues(pagination);
                        let first = 10;
                        let cursor = 0;
                        let opts = {};

                        if (pages) {
                            first = pages[0] || 10;
                            cursor = pages[1] || 0;
                            opts = pages[2] || {};
                        }

                        if (first > 0) opts.pagecount = Math.ceil(docs.length / first);

                        if (opts.timesorted) docs.sort((a, b) => {
                            if (a.time) return (-1) * (a.time - b.time);
                            else if (a.iat) return (-1) * (a.iat - b.iat);
                            else return 0;
                        });

                        if (opts.customsort) docs.sort((a, b) => {
                            return (-1) * (a[opts.customsort] - b[opts.customsort]);
                        });

                        resolve({
                            data: docs.slice(first * cursor, first * (cursor + 1)),
                            pagination: this.GetPaginationString(first, Math.min(first * (cursor + 1), opts.pagecount), opts)
                        });
                    } else {
                        resolve(docs);
                    }
                }
            });
        });
    }
    GetPaginationValues(pagination = "") {
        if (!pagination) return null;
        let out = [10, 0, {}];

        try {
            if (pagination.indexOf('A') >= 0 && pagination.indexOf('B') >= 0 && pagination.indexOf('C') >= 0) {
                out[0] = parseInt(pagination.substring(1, pagination.indexOf('B')));
                out[1] = parseInt(pagination.substring(pagination.indexOf('B') + 1, pagination.indexOf('C')));
            }

            if (pagination.indexOf('T') >= 0) out[2].timesorted = true;
            if (pagination.indexOf('CSS') >= 0 && pagination.indexOf('CSE') >= 0) {
                out[2].customsort = pagination.substring(pagination.indexOf('CSS') + 3, pagination.indexOf('CSE'));
            }
            if (pagination.indexOf('PS') >= 0 && pagination.indexOf('PE') >= 0) out[2].pagecount = parseInt(pagination.substring(pagination.indexOf('PS') + 2, pagination.indexOf('PE')));
        } catch (err) {
            return null;
        }

        return out;
    }
    GetPaginationString(first = 10, cursor = 0, options = {}) {
        let s = "A" + first + "B" + cursor + "C";
        if (options.timesorted) s += "T";
        if (options.customsort) s += "CSS" + options.customsort + "CSE";
        if (options.pagecount !== undefined) s += "PS" + options.pagecount + "PE";
        return s;
    }
}

module.exports.Stats = Stats;