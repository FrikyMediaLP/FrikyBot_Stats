let BADGE_DATA = {};
const TTV_IMAGE_URL = "https://static-cdn.jtvnw.net/emoticons/v2/{id}/{format}/dark/3.0";
const FFZ_IMAGE_URL = "https://cdn.frankerfacez.com/emote/{id}/4";
const BTTV_IMAGE_URL = "https://api.betterttv.net/3/emotes/{id}";
const TYPE_IMAGES = {
    'ffz': "/images/icons/FFZ.png",
    "bttv": "/images/icons/BTTV.png",
    "ttv": "/images/icons/twitch_colored.png"
};

//USER
function createSimpleUser(user) {
    let s = "";

    s += '<div class="SIMPLE_USER">';

    //HEADER
    s += '<h1 class="USER_HEADER">';
    s += '<a href="/stats/user/' + user.user_id + '">';
    s += '<span class="USER_NAME">' + user.user_name + '</span>';
    s += '<span class="USER_ID" title="User ID">' + user.user_id + '</span>';
    s += '</a>';
    s += '<span class="USER_BADGES">';
    for (let badge in user.badges) {
        if (badge === 'subscriber') {
            let month = parseInt(user.badge_info['subscriber']) || 0;
            s += '<img src="' + getSubBadge(month) + '" title="Subscriber Month: ' + month + '" />'
            continue;
        }

        if (!BADGE_DATA[badge] || !BADGE_DATA[badge].versions[user.badges[badge]]) continue;
        s += getImgFromBadge(BADGE_DATA[badge].versions[user.badges[badge]], 1);
    }
    s += '</span>';
    s += '</h1>';

    s += '<div class="USER_STATS_WRAPPER">';

    //Totals
    s += '<div class="STAT_TABLE">';
    s += '<p>TOTAL STATS</p>';
    s += '<div>';
    s += '<div class="STAT_TABLE_ELEMENT">';
    s += '<p class="STAT_NAME">TOTAL MESSAGES</p>';
    s += '<p class="STAT_VALUE">' + user.message_count + '</p>';
    s += '</div>';

    s += '<div class="STAT_TABLE_ELEMENT">';
    s += '<p class="STAT_NAME">TOTAL EMOTES</p>';
    s += '<p class="STAT_VALUE">' + user.emote_count + '</p>';
    s += '</div>';

    s += '</div>';
    s += '</div>';

    //Emotes
    s += '<div class="STAT_TABLE STAT_TABLE_INDEXED">';
    s += '<p>TOP EMOTES</p>';
    s += '<div>';

    let i = 1;
    for (let emote of user.emotes.sort((a, b) => b.count - a.count)) {
        if (i === 5) break;

        s += '<div class="STAT_TABLE_ELEMENT">';
        s += '<p class="STAT_IDX">' + (i++) + '</p>';
        s += '<p class="STAT_NAME"><img src="' + getImageURLOfEmote(emote.type, emote.emote_id, 2) + '" /><span>' + emote.emote_name + '</span></p>';
        s += '<p class="STAT_VALUE">' + emote.count + '</p>';
        s += '</div>';
    }

    s += '</div>';
    s += '</div>';

    s += '</div>';

    s += '</div>';

    return s + '</div>';
}

//EMOTE
function createSimpleEmote(emote) {
    let s = "";

    s += '<div class="SIMPLE_EMOTE">';

    //HEADER
    s += '<h1 class="EMOTE_HEADER">';
    s += '<a href="emotes/' + emote.emote_id + '">';
    s += '<img class="EMOTE_IMG" src="' + getImageURLOfEmote(emote.type, emote.emote_id, 3) + '" />';
    s += '<span class="EMOTE_NAME">' + emote.emote_name + '</span>';
    s += '<span class="EMOTE_ID" title="Emote ID">' + emote.emote_id + '</span>';
    s += '</a>';
    s += '<img class="EMOTE_TYPE" title="Emote Origin: ' + emote.type.toUpperCase() + '" src="' + TYPE_IMAGES[emote.type] + '" />';
    s += '</h1>';

    s += '<div class="EMOTE_STATS_WRAPPER">';

    //Totals
    s += '<div class="STAT_TABLE">';
    s += '<p>TOTAL STATS</p>';
    s += '<div>';
    s += '<div class="STAT_TABLE_ELEMENT">';
    s += '<p class="STAT_NAME">TOTAL USAGE</p>';
    s += '<p class="STAT_VALUE">' + emote.count + '</p>';
    s += '</div>';

    s += '</div>';
    s += '</div>';

    //Users
    s += '<div class="STAT_TABLE STAT_TABLE_INDEXED">';
    s += '<p>TOP USERS</p>';
    s += '<div>';
    let i = 1;
    for (let user of emote.users.sort((a, b) => b.count - a.count)) {
        if (i === 5) break;

        s += '<div class="STAT_TABLE_ELEMENT">';
        s += '<p class="STAT_IDX">' + (i++) + '</p>';
        s += '<p class="STAT_NAME">' + user.user_name + '</p>';
        s += '<p class="STAT_VALUE">' + user.count + '</p>';
        s += '</div>';
    }
    s += '</div>';
    s += '</div>';

    s += '</div>';

    return s + '</div>';
}

//STREAM
function createStream(stream) {
    let s = "";

    s += '<div class="SIMPLE_STREAM FULL_STREAM">';

    //HEADER
    s += '<h1 class="STREAM_HEADER">';
    s += '<a href="/Stats/Streams/' + stream.stream_id + '">';
    s += '<span class="STREAM_NAME">Stream from ' + (new Date(stream.started_at)).toLocaleDateString("de-DE") + " " + (new Date(stream.started_at)).toLocaleTimeString("de-DE").split(":").slice(0, 2).join(":");
    s += '<span class="STREAM_ID" title="Stream ID">' + stream.stream_id + '</span>';
    s += '</span>';
    s += '</a>';
    s += '</h1>';

    s += '<h2 title="First Stream Title">' + stream.titles[0].name + '</h2>';

    s += '<div class="STREAM_STATS_WRAPPER">';

    //Totals
    s += '<div class="STAT_TABLE">';
    s += '<p>TOTAL STATS</p>';
    s += '<div>';

    s += '<div class="STAT_TABLE_ELEMENT">';
    s += '<p class="STAT_NAME">TOTAL MESSAGES</p>';
    s += '<p class="STAT_VALUE">' + stream.messages.length + '</p>';
    s += '</div>';

    s += '<div class="STAT_TABLE_ELEMENT">';
    s += '<p class="STAT_NAME">TOTAL EMOTES</p>';
    s += '<p class="STAT_VALUE">' + stream.emotes.length + '</p>';
    s += '</div>';

    s += '</div>';
    s += '</div>';

    //Top Chatters
    s += '<div class="STAT_TABLE STAT_TABLE_INDEXED">';
    s += '<p>TOP CHATTERS</p>';
    for (let i = 0; i < stream.chatters.length && i < -1; i++) {
        s += '<div class="STAT_TABLE_ELEMENT">';
        s += '<p class="STAT_IDX">' + (i++) + '</p>';
        s += '<p class="STAT_NAME">' + stream.chatters[i].user_name + '</p>';
        s += '<p class="STAT_VALUE">' + stream.chatters[i].count + '</p>';
        s += '</div>';
    }
    if (stream.chatters.length == 0) s += '<div class="STAT_TABLE_ELEMENT"><p class="STAT_IDX"></p><p class="STAT_NAME EMPTY">EMPTY</p><p class="STAT_VALUE"></p></div>';
    s += '</div>';

    //Total Viewes
    s += '<div class="STAT_TABLE">';
    s += '<p>TOTAL VIEWERS</p>';
    s += MISC_SELECT_create(stream.total_viewers);
    s += '</div>';

    //Subs
    s += '<div class="STAT_TABLE STAT_TABLE_INDEXED STAT_TABLE_INDEXED_WIDE">';
    s += '<p>Monetisatons</p>';
    for (let sub of stream.subscriptions) {
        s += '<div class="STAT_TABLE_ELEMENT">';
        s += '<p class="STAT_IDX">' + sub.type + '</p>';
        s += '<p class="STAT_NAME">' + sub.user_name + '</p>';
        s += '<p class="STAT_VALUE">' + (sub.target_name || sub.total || sub.cumulative_months || sub.bits || Tims2String(sub.time, 'relative')) + '</p>';
        s += '</div>';
    }
    s += '</div>';

    //Emotes
    s += '<div class="STAT_TABLE STAT_TABLE_INDEXED">';
    s += '<p>TOP EMOTES</p>';
    s += '<div>';
    let i = 1;
    for (let emote of stream.emotes.sort((a, b) => b.count - a.count)) {
        s += '<div class="STAT_TABLE_ELEMENT">';
        s += '<p class="STAT_IDX">' + (i++) + '</p>';
        s += '<p class="STAT_NAME"><img src="' + getImageURLOfEmote(emote.type, emote.emote_id, 2) + '" /><span>' + emote.emote_name + '</span></p>';
        s += '<p class="STAT_VALUE">' + emote.count + '</p>';
        s += '</div>';
    }
    s += '</div>';
    s += '</div>';

    //Chat
    s += '<div class="STAT_TABLE STAT_TABLE_INDEXED CHAT">';
    s += '<p>Messages</p>';
    for (let msg of stream.messages) {
        s += '<div class="STAT_TABLE_ELEMENT">';

        let badge_str = "";
        for (let badge in msg.badges) {
            if (badge === 'subscriber') {
                let month = parseInt(msg['badge-info']['subscriber']) || 0;
                badge_str += '<img src="' + getSubBadge(month) + '" title="Subscriber Month: ' + month + '" />'
                continue;
            }

            if (!BADGE_DATA[badge] || !BADGE_DATA[badge].versions[msg.badges[badge]]) continue;
            badge_str += getImgFromBadge(BADGE_DATA[badge].versions[msg.badges[badge]], 1);
        }

        s += '<p class="STAT_IDX">' + badge_str + '</p>';
        s += '<p class="STAT_NAME">' + msg.user_name + '</p>';
        s += '<p class="STAT_VALUE">' + ReplaceEmotes(msg.message, ConvertIRCEmotesToEventSubEmotes(msg.emotes_ttv), ConvertIRCEmotesToEventSubEmotes(msg.emotes_ffz), ConvertIRCEmotesToEventSubEmotes(msg.emotes_bttv)) + '</p>';
        s += '</div>';
    }
    s += '</div>';

    s += '</div>';
    s += '</div>';

    return s + '</div>';
}
function createSimpleStream(stream) {
    let s = "";

    s += '<div class="SIMPLE_STREAM">';

    //HEADER
    s += '<h1 class="STREAM_HEADER">';
    s += '<a href="/Stats/Streams/' + stream.stream_id + '">';
    s += '<span class="STREAM_NAME">Stream from ' + (new Date(stream.started_at)).toLocaleDateString("de-DE") + " " + (new Date(stream.started_at)).toLocaleTimeString("de-DE").split(":").slice(0,2).join(":");
    s += '<span class="STREAM_ID" title="Stream ID">' + stream.stream_id + '</span>';
    s += '</span>';
    s += '</a>';
    s += '</h1>';

    s += '<h2 title="First Stream Title">' + stream.titles[0].name + '</h2>';

    s += '<div class="STREAM_STATS_WRAPPER">';
    
    //Totals
    s += '<div class="STAT_TABLE">';
    s += '<p>TOTAL STATS</p>';
    s += '<div>';

    s += '<div class="STAT_TABLE_ELEMENT">';
    s += '<p class="STAT_NAME">TOTAL MESSAGES</p>';
    s += '<p class="STAT_VALUE">' + stream.messages.length + '</p>';
    s += '</div>';

    s += '<div class="STAT_TABLE_ELEMENT">';
    s += '<p class="STAT_NAME">TOTAL EMOTES</p>';
    s += '<p class="STAT_VALUE">' + stream.emotes.length + '</p>';
    s += '</div>';

    s += '</div>';
    s += '</div>';
    
    //Users
    s += '<div class="STAT_TABLE STAT_TABLE_INDEXED">';
    s += '<p>TOP CHATTERS</p>';
    for (let user of stream.chatters || []) {
        break;
        s += '<div class="STAT_TABLE_ELEMENT">';
        s += '<p class="STAT_NAME">' + user.user_name + '</p>';
        s += '<p class="STAT_VALUE">' + user.count + '</p>';
        s += '</div>';
    }
    if (stream.chatters && stream.chatters.length == 0) s += '<div class="STAT_TABLE_ELEMENT"><p class="STAT_NAME EMPTY" >NONE</p><p class="STAT_VALUE"></p></div>';
    s += '<div>';

    s += '</div>';
    s += '</div>';

    s += '</div>';

    return s + '</div>';
}

//UTIL Emotes
function getImageURLOfEmote(type, emote_id, scale = 1) {
    if (type === 'ttv') return getTTVImage(emote_id, scale);
    else if (type === 'bttv') return getBTTVImage(emote_id, scale);
    else if (type === 'ffz') return getFFZImage(emote_id, scale);
    return "";
}
function getTTVImage(emote_id, scale = 1) {
    return "https://static-cdn.jtvnw.net/emoticons/v2/" + emote_id + "/default/light/" + scale + ".0";
}
function getBTTVImage(emote_id, scale = 1) {
    return "https://cdn.betterttv.net/emote/" + emote_id + "/" + scale + "x";
}
function getFFZImage(emote_id, scale = 1) {
    if (scale > 2) scale = 4;
    return "https://cdn.frankerfacez.com/emote/" + emote_id + "/" + scale;
}
function ReplaceEmotes(message = "", ttv = [], ffz = [], bttv = []) {
    let replaced_message = "";

    let emotes = [];
    for (let emote of ttv) emotes.push({ type: 'ttv', data: emote });
    for (let emote of ffz) emotes.push({ type: 'ffz', data: emote });
    for (let emote of bttv) emotes.push({ type: 'bttv', data: emote });
    emotes.sort((a, b) => b.begin - a.begin);

    let last_end = 0;
    for (let emote of emotes) {
        let img = '<img title="' + message.substring(emote.data.begin - 1, emote.data.end + 1) + '" src="';
        if (emote.type === 'ttv') img += FillFormattedString(TTV_IMAGE_URL, { id: emote.data.id, format: 'default' });
        if (emote.type === 'bttv') img += FillFormattedString(BTTV_IMAGE_URL, { id: emote.data.id });
        if (emote.type === 'ffz') img += FillFormattedString(FFZ_IMAGE_URL, { id: emote.data.id });
        img += '" />';

        replaced_message += '<span>' + message.substring(last_end, emote.data.begin) + '</span><span>' + img + '</span>';
        last_end = emote.data.end + 1;
    }
    replaced_message += '<span>' + message.substring(last_end) + '</span>';

    return replaced_message;
}
function ConvertIRCEmotesToEventSubEmotes(emotes = {}) {
    let es_emotes = [];
    for (let id in emotes) {
        for (let place of emotes[id]) {
            try {
                let begin = parseInt(place.split('-')[0]);
                let end = parseInt(place.split('-')[1]);
                es_emotes.push({ begin, end, id });
            } catch (err) {

            }
        }
    }
    return es_emotes;
}

//UTIL Badges
async function updateBadgeData() {
    try {
        BADGE_DATA = (await fetch('https://badges.twitch.tv/v1/badges/global/display').then(data => data.json())).badge_sets;
    } catch (err) {

    }

    return Promise.resolve(BADGE_DATA);
}
function getImgFromBadge(obj, res) {
    if (!obj || !obj.title || !obj.description || !obj.image_url_1x || !obj.image_url_2x || !obj.image_url_4x || !obj.click_action) {
        return null;
    }

    let temp = '<img src="' + obj['image_url_' + (res ? res : 1) + 'x'] + '" title="' + obj.title + '" />';

    if (obj.click_action == "visit_url") {
        return '<a href="' + obj.click_url + '" target="_blank">' + temp + '</a>'
    } else {
        return temp;
    }
}
function getSubBadge(month) {
    if (month > 96) return "/images/Badges/subscriber_96.png";
    if (month > 84) return "/images/Badges/subscriber_84.png";
    if (month > 72) return "/images/Badges/subscriber_72.png";
    if (month > 60) return "/images/Badges/subscriber_60.png";
    if (month > 48) return "/images/Badges/subscriber_48.png";
    if (month > 36) return "/images/Badges/subscriber_36.png";
    if (month > 24) return "/images/Badges/subscriber_24.png";
    if (month > 12) return "/images/Badges/subscriber_12.png";
    if (month > 9) return "/images/Badges/subscriber_9.png";
    if (month > 6) return "/images/Badges/subscriber_6.png";
    if (month > 3) return "/images/Badges/subscriber_3.png";
    return "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1";
}

//UTIL General
function Tims2String(t_ms, mode) {
    if (t_ms === undefined) return '-';
    if (t_ms < Date.now() / 10) t_ms *= 1000;

    if (mode === 'relative') {
        let rel = Date.now() - t_ms;

        if (rel > 0) {
            if (rel < 60 * 1000) return 'a minute ago';
            else if (rel < 60 * 60 * 1000) return Math.floor(rel / (60 * 1000)) + ' minutes ago';
            else if (rel < 2 * 60 * 60 * 1000) return 'an hour ago';
            else if (rel < 24 * 60 * 60 * 1000) return Math.floor(rel / (60 * 60 * 1000)) + ' hours ago';
        } else {
            rel = -1 * rel;
            if (rel < 60 * 1000) return 'in ' + Math.floor(rel / 1000) + ' seconds';
            else if (rel < 2 * 60 * 1000) return 'in a minute';
            else if (rel < 60 * 60 * 1000) return 'in ' + Math.floor(rel / (60 * 1000)) + ' minutes';
            else if (rel < 2 * 60 * 60 * 1000) return 'in an hour';
            else if (rel < 24 * 60 * 60 * 1000) return 'in ' + Math.floor(rel / (60 * 60 * 1000)) + ' hours';
        }
    }

    let date = new Date(t_ms);
    return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE').split(':').slice(0, 2).join(':');
}