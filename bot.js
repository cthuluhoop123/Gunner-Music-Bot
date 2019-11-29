require('dotenv').config();

const Spotify = require('./musicAPI/spotify.js');
const spotify = new Spotify(process.env.SPOTIFY_CLIENTID, process.env.SPOTIFY_CLIENTSECRET);

const Soundcloud = require('./musicAPI/soundcloud.js');
const soundcloud = new Soundcloud(process.env.SOUNDCLOUD_CLIENTID);

const prefix = '!';

const db = require('quick.db');

const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(await client.generateInvite());
    await spotify.authenticate().catch(err => console.error(err));
    timer();
});

client.on('message', async message => {
    if (!message.member.hasPermission('ADMINISTRATOR') || !message.content.startsWith(prefix)) { return; }
    const args = message.content.split(' ');
    const command = args.shift().slice(prefix.length).toLowerCase();
    if (command === 'trackplaylist') {
        try {
            const playlistData = await spotify.getPlaylist(args[0]);
            db.push(`PLAYLIST:${message.channel.id}`, 'fix' + args[0]);
            db.set(`PLAYLISTMETA:${args[0]}`, playlistData.name);
            message.reply(`Spotify playlist: **${playlistData.name}** added to tracking list!`);
        } catch (err) {
            if (err.message === 'Not Found') {
                message.reply('Could not find a user with that soundcloud username.');
            } else {
                message.reply('An unexpected error occured while looking that up.');
                console.error(err);
            }
        }
    }
    if (command === 'trackartist') {
        try {
            const artistData = await spotify.getArtist(args[0]);
            db.push(`ARTIST:${message.channel.id}`, 'fix' + args[0]);
            db.set(`ARTISTMETA:${args[0]}`, artistData.name);
            message.reply(`Spotify artist: **${artistData.name}** added to tracking list!`);
        } catch (err) {
            if (err.message === 'Not Found') {
                message.reply('Could not find a user with that soundcloud username.');
            } else {
                message.reply('An unexpected error occured while looking that up.');
                console.error(err);
            }
        }
    }
    if (command === 'trackscuser') {
        const username = args[0];
        try {
            const resolvedFromSoundcloud = await soundcloud.resolve('https://soundcloud.com/' + username);
            if (resolvedFromSoundcloud.kind !== 'user') {
                message.reply('That is not a URL of a user.');
                return;
            }
            db.push(`SCUSER:${message.channel.id}`, 'fix' + resolvedFromSoundcloud.id);
            message.reply(`Soundcloud user ${resolvedFromSoundcloud.username} added to tracking list!`);
        } catch (err) {
            if (err.message === 'Not Found') {
                message.reply('Could not find a user with that soundcloud username.');
            } else {
                message.reply('An unexpected error occured while looking that up.');
                console.error(err);
            }
        }
    }
    if (command === 'test') {
        await checkForNew(message.channel.id).catch(err => console.error(err));
    }
});

client.login(process.env.DISCORD_TOKEN);

async function timer() {
    for (channelID of client.channels.filter(channel => channel.type === 'text').map(channel => channel.id)) {
        await checkForNew(channelID).catch(err => console.error(err));
    }
    setTimeout(timer, 1000 * 60 * 7);
}

async function checkForNew(channelID) {
    await spotify.authenticate();
    const newFromPlaylists = await checkSpotifyPlaylists(channelID);
    const newFromArtists = await checkSpotifyArtists(channelID);
    const newFromSC = await checkSoundcloud(channelID);
    newFromPlaylists.forEach(([playlistID, tracks]) => {
        const playlistName = db.get(`PLAYLISTMETA:${playlistID}`);
        tracks.forEach(track => {
            client.channels.get(channelID).send({
                embed: createSongEmbed({
                    color: 0x1DB954,
                    author: track.added_by.id,
                    title: `${playlistName} - ${track.track.name}`,
                    href: track.added_by.external_urls.spotify,
                    thumbnail: track.track.album.images[0].url,
                    body: `[Link to playlist](https://open.spotify.com/playlist/${playlistID})\n[Link to track](${track.track.external_urls.spotify})`
                })
            });
        });
    });
}

async function checkSpotifyPlaylists(channelID) {
    const trackedSpotifyPlaylists = db.get(`PLAYLIST:${channelID}`) || [];
    const ignoredSongs = db.get('IGNORED_SONGS') || [];
    return (await Promise.all(
        trackedSpotifyPlaylists.map(async playlistID => {
            const { items } = await spotify.getPlaylistTracks(playlistID.slice(3));
            const newSongs = items.filter(item => !ignoredSongs.includes('fix' + item.track.id));
            newSongs.forEach(song => db.push('IGNORED_SONGS', 'fix' + song.track.id));
            return [playlistID.slice(3), newSongs];
        })
    ));
}

async function checkSpotifyArtists(channelID) {
    const trackedSpotifyArtists = db.get(`ARTIST:${channelID}`) || [];
    const ignoredAlbums = db.get('IGNORED_ALBUMS') || [];
    return (await Promise.all(
        trackedSpotifyArtists.map(async artistID => {
            const { items } = await spotify.getArtistAlbums(artistID.slice(3));
            const newAlbums = items.filter(item => !ignoredAlbums.includes('fix' + item.id));
            newAlbums.forEach(item => db.push('IGNORED_ALBUMS', 'fix' + item.id));
            return newAlbums;
        })
    )).flat();
}

async function checkSoundcloud(channelID) {
    const trackedSoundcloudUsers = db.get(`SCUSER:${channelID}`) || [];
    const ignoredTracks = db.get('IGNORED_TRACKS') || [];
    return (await Promise.all(
        trackedSoundcloudUsers.map(async userID => {
            const tracks = await soundcloud.getUserTracks(userID.slice(3));
            const newTracks = tracks.filter(track => !ignoredTracks.includes('fix' + track.id));
            newTracks.forEach(track => db.push('IGNORED_TRACKS', 'fix' + track.id));
            return newTracks;
        })
    )).flat();
}

function createSongEmbed(data) {
    return new Discord.RichEmbed()
        .setColor(data.color)
        .setAuthor(data.author, null, data.href)
        .setTitle(data.title)
        .setThumbnail(data.thumbnail)
        .setDescription(data.body);
}