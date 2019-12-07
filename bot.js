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
            const inDb = db.get(`PLAYLIST:${message.channel.id}`);
            if (inDb && inDb.includes('fix' + args[0])) {
                message.reply(`That playlist is already in the tracking list!`);
                return;
            }
            const playlistData = await spotify.getPlaylist(args[0]);
            db.push(`PLAYLIST:${message.channel.id}`, 'fix' + args[0]);
            db.set(`PLAYLISTMETA:${args[0]}`, playlistData.name);
            message.reply(`Spotify playlist: **${playlistData.name}** added to tracking list!`);
            checkSpotifyPlaylists(null, args[0]).catch(err => console.error(err));
        } catch (err) {
            if (err.message === 'Not Found') {
                message.reply('Could not find a user with that soundcloud username.');
            } else {
                message.reply('An unexpected error occured while looking that up.');
                console.error(err);
            }
        }
    }
    if (command === 'untrackplaylist') {
        const inDb = db.get(`PLAYLIST:${message.channel.id}`);
        db.set(`PLAYLIST:${message.channel.id}`, inDb.filter(playlist => playlist !== 'fix' + args[0]));
        const playlistName = db.get(`PLAYLISTMETA:${args[0]}`);
        if (playlistName) {
            message.reply(`Spotify playlist: **${playlistName}** removed from tracking list!`);
        } else {
            message.reply(`Spotify playlist removed from tracking list!`);
        }
    }
    if (command === 'trackartist') {
        try {
            const inDb = db.get(`ARTIST:${message.channel.id}`);
            if (inDb && inDb.includes('fix' + args[0])) {
                message.reply(`That artist is already in the tracking list!`);
                return;
            }
            const artistData = await spotify.getArtist(args[0]);
            db.push(`ARTIST:${message.channel.id}`, 'fix' + args[0]);
            db.set(`ARTISTMETA:${args[0]}`, artistData.name);
            message.reply(`Spotify artist: **${artistData.name}** added to tracking list!`);
            checkSpotifyArtists(null, args[0]).catch(err => console.error(err));
        } catch (err) {
            if (err.message === 'Not Found') {
                message.reply('Could not find a user with that soundcloud username.');
            } else {
                message.reply('An unexpected error occured while looking that up.');
                console.error(err);
            }
        }
    }
    if (command === 'untrackartist') {
        const inDb = db.get(`ARTIST:${message.channel.id}`);
        db.set(`ARTIST:${message.channel.id}`, inDb.filter(artist => artist !== 'fix' + args[0]));
        const artistName = db.get(`ARTISTMETA:${args[0]}`);
        if (artistName) {
            message.reply(`Spotify artist: **${artistName}** removed from tracking list!`);
        } else {
            message.reply(`Spotify artist removed from tracking list!`);
        }
    }
    if (command === 'trackscuser') {
        const username = args[0];
        try {
            const resolvedFromSoundcloud = await soundcloud.resolve('https://soundcloud.com/' + username);
            const inDb = db.get(`SCUSER:${message.channel.id}`);
            if (inDb && inDb.includes('fix' + resolvedFromSoundcloud.id)) {
                message.reply(`That user is already in the tracking list!`);
                return;
            }
            if (resolvedFromSoundcloud.kind !== 'user') {
                message.reply('That is not a URL of a user.');
                return;
            }
            db.push(`SCUSER:${message.channel.id}`, 'fix' + resolvedFromSoundcloud.id);
            message.reply(`Soundcloud user **${resolvedFromSoundcloud.username}** added to tracking list!`);
            checkSoundcloud(null, resolvedFromSoundcloud.id).catch(err => console.error(err));
        } catch (err) {
            if (err.message === 'Not Found') {
                message.reply('Could not find a user with that soundcloud username.');
            } else {
                message.reply('An unexpected error occured while looking that up.');
                console.error(err);
            }
        }
    }
    if (command === 'untrackscuser') {
        const inDb = db.get(`SCUSER:${message.channel.id}`);
        db.set(`SCUSER:${message.channel.id}`, inDb.filter(scuser => scuser !== 'fix' + args[0]));
        message.reply(`Soundcloud user: **${args[0]}** removed from tracking list!`);
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
    newFromArtists.forEach(([artistID, albums]) => {
        const artistName = db.get(`ARTISTMETA:${artistID}`);
        albums.forEach(album => {
            client.channels.get(channelID).send({
                embed: createSongEmbed({
                    color: 0x1DB954,
                    author: artistName,
                    title: `${artistName} - ${album.name} (${album.type})`,
                    href: `https://open.spotify.com/artist/${artistID}`,
                    thumbnail: album.images[0].url,
                    body: `[Link to album](https://open.spotify.com/album/${album.id})`
                })
            });
        });
    });
    newFromSC.forEach(soundcloudTrack => {
        client.channels.get(channelID).send({
            embed: createSongEmbed({
                color: 0xff7700,
                author: soundcloudTrack.user.username,
                title: `${soundcloudTrack.user.permalink} - ${soundcloudTrack.title}`,
                href: soundcloudTrack.user.permalink_url,
                thumbnail: soundcloudTrack.artwork_url,
                body: `[Link to track](${soundcloudTrack.permalink_url})`
            })
        });
    });
}

async function checkSpotifyPlaylists(channelID, playlistID) {
    const ignoredSongs = db.get('IGNORED_SONGS') || [];
    if (playlistID) {
        const { items } = await spotify.getPlaylistTracks(playlistID);
        const newSongs = items.filter(item => !ignoredSongs.includes('fix' + item.track.id));
        newSongs.forEach(song => db.push('IGNORED_SONGS', 'fix' + song.track.id));
        return [playlistID, newSongs];
    }

    const trackedSpotifyPlaylists = db.get(`PLAYLIST:${channelID}`) || [];
    return (await Promise.all(
        trackedSpotifyPlaylists.map(async playlistID => {
            const { items } = await spotify.getPlaylistTracks(playlistID.slice(3));
            const newSongs = items.filter(item => !ignoredSongs.includes('fix' + item.track.id));
            newSongs.forEach(song => db.push('IGNORED_SONGS', 'fix' + song.track.id));
            return [playlistID.slice(3), newSongs];
        })
    ));
}

async function checkSpotifyArtists(channelID, artistID) {
    const ignoredAlbums = db.get('IGNORED_ALBUMS') || [];
    if (artistID) {
        const { items } = await spotify.getArtistAlbums(artistID);
        const newAlbums = items.filter(item => !ignoredAlbums.includes('fix' + item.id));
        newAlbums.forEach(item => db.push('IGNORED_ALBUMS', 'fix' + item.id));
        return [artistID, newAlbums];
    }
    const trackedSpotifyArtists = db.get(`ARTIST:${channelID}`) || [];
    return (await Promise.all(
        trackedSpotifyArtists.map(async artistID => {
            const { items } = await spotify.getArtistAlbums(artistID.slice(3));
            const newAlbums = items.filter(item => !ignoredAlbums.includes('fix' + item.id));
            newAlbums.forEach(item => db.push('IGNORED_ALBUMS', 'fix' + item.id));
            return [artistID.slice(3), newAlbums];
        })
    ));
}

async function checkSoundcloud(channelID, userID) {
    const ignoredTracks = db.get('IGNORED_TRACKS') || [];
    if (userID) {
        const tracks = await soundcloud.getUserTracks(userID);
        const newTracks = tracks.filter(track => !ignoredTracks.includes('fix' + track.id));
        newTracks.forEach(track => db.push('IGNORED_TRACKS', 'fix' + track.id));
        return newTracks;
    }
    const trackedSoundcloudUsers = db.get(`SCUSER:${channelID}`) || [];
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