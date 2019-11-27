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
});

client.on('message', async message => {
    if (!message.member.hasPermission('ADMINISTRATOR') || !message.content.startsWith(prefix)) { return; }
    const args = message.content.split(' ');
    const command = args.shift().slice(prefix.length).toLowerCase();
    if (command === 'trackplaylist') { db.push(`PLAYLIST:${message.channel.id}`, args[0]); }
    if (command === 'trackartist') { db.push(`ARTIST:${message.channel.id}`, args[0]); }
    if (command === 'trackscuser') { db.push(`SCUSER:${message.channel.id}`, args[0]); }
    if (command === 'test') {
        await checkForNew(message.channel.id).catch(err => console.error(err));
    }
});

client.login(process.env.DISCORD_TOKEN);

async function checkForNew(channelID) {
    await spotify.authenticate();
    const newFromPlaylists = await checkSpotifyPlaylists(channelID);
    const newFromArtists = await checkSpotifyArtists(channelID);
    console.log(newFromPlaylists);
    console.log(newFromArtists);
}

async function checkSpotifyPlaylists(channelID) {
    const trackedSpotifyPlaylists = db.get(`PLAYLIST:${channelID}`) || [];
    const ignoredSongs = db.get('IGNORED_SONGS') || [];
    return await Promise.all(
        trackedSpotifyPlaylists.map(async playlistID => {
            const { items } = await spotify.getPlaylist(playlistID);
            const newSongs = items.filter(item => !ignoredSongs.includes(item.track.id));
            return newSongs;
        })
    );
}

async function checkSpotifyArtists(channelID) {
    const trackedSpotifyArtists = db.get(`ARTIST:${channelID}`) || [];
    const ignoredAlbums = db.get('IGNORED_ALBUMS') || [];
    return await Promise.all(
        trackedSpotifyArtists.map(async artistID => {
            const { items } = await spotify.getArtistAlbums(artistID);
            const newAlbums = items.filter(item => !ignoredAlbums.includes(item.id));
            return newAlbums;
        })
    );
}

async function checkSoundcloud(channelID) {
    const trackedSoundcloudUser = db.get(`SCUSER:${message.channel.id}`) || [];
    const ignoredTracks = db.get('IGNORED_TRACKS') || [];
    return await Promise.all(
        trackedSoundcloudUser.map(userID => {
            const tracks = await soundcloud.getUserTracks(userID);
            const newTracks = tracks.filter(track => !ignoredTracks.includes(track.id));
        })
    );
}