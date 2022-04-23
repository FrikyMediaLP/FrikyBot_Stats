# Stats Package 
This Repository is a Package for the FrikyBot.

The Stats Package is collection of all Data comming into the Bot. From Chat Messages and Events to Stream Analytics is collected and displayed.

Note: This is Code cant be run on its own, its still tied to the FrikyBot Interface and Ecosystem!

## Getting Started
This Package is powered by Node.js and some NPM Modules.

All dependancies are:
* [express](https://www.npmjs.com/package/express) - providing File and API Routing Capabilities
* [nedb](https://www.npmjs.com/package/nedb) - Database Manager (to be replaced with MongoDB "soon")

Installing a Package is very easy! Clone this Package to your local machine, wrap it in Folder Named "Stats" and drop that into your FrikyBot Packages Folder.
Now use the FrikyBot WebInterface and add the Package on the Settings->Packages Page.

## Features

### Currently Under Refactor
The Stats Package is a huge complicated Datastructure problem! One thing to nail is consistency of Dataformats - currently FrikyBots Twitch IRC Module is beeing rewritten, until thats done Data is currently only collected in the Stats Package so i may be analysed later.

## Planned Features
* **Stream Stats** - Stats per Stream rangin from Emote usage, Top Chatters, Viewer Lists/Counts, Commands, Games and many many more.
* **User Stats** - Stats per User of their individual Emote usage, Commands, visited Streams, Games and many more.
* **Emote Stats** - Stats per Emotes of their usage per User, Game and Stream.
* **Game Stats** - Stats per Game of their playtime, viewers, chat messages and monetization.
* **MUCH MUCH MORE** - including Commands, Clips, Channelpoints, Predictions and more.

## Updates
Follow the official [Twitter](https://twitter.com/FrikyBot) Account or take a look at the [FrikyBot News](https://frikybot.de/News) to see upcomming Features and Updates.

## Authors
* **Tim Klenk** - [FrikyMediaLP](https://github.com/FrikyMediaLP)
