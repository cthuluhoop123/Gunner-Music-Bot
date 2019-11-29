const request = require('superagent');
const base = 'https://api.spotify.com/v1';

class Spotify {
    constructor(clientID, clientSecret) {
        this.clientID = clientID;
        this.clientSecret = clientSecret;
    }

    authenticate() {
        return new Promise((resolve, reject) => {
            const Authorization = 'Basic ' + Buffer.from(`${this.clientID}:${this.clientSecret}`).toString('base64');
            request
                .post('https://accounts.spotify.com/api/token')
                .type('form')
                .set('Authorization', Authorization)
                .send({
                    grant_type: 'client_credentials'
                })
                .then(res => {
                    this.token = res.body.access_token;
                    setTimeout(() => {
                        this.authenticate().catch(err => {
                            console.error(err);
                        });
                    }, res.body.expires_in * 1000);
                    resolve();
                })
                .catch(reject);
        });
    }

    getArtist(artistID) {
        return new Promise((resolve, reject) => {
            request
                .get(base + `/artists/${artistID}`)
                .set('Authorization', `Bearer ${this.token}`)
                .then(res => {
                    resolve(res.body);
                })
                .catch(reject);
        });
    }

    getArtistAlbums(artistID) {
        return new Promise((resolve, reject) => {
            request
                .get(base + `/artists/${artistID}/albums`)
                .set('Authorization', `Bearer ${this.token}`)
                .then(res => {
                    resolve(res.body);
                })
                .catch(reject);
        });
    }

    getPlaylist(playlistID) {
         return new Promise((resolve, reject) => {
             request
                 .get(base + `/playlists/${playlistID}`)
                 .set('Authorization', `Bearer ${this.token}`)
                 .then(res => {
                     resolve(res.body);
                 })
                 .catch(reject);
         });
    }

    getPlaylistTracks(playlistID) {
        return new Promise((resolve, reject) => {
            request
                .get(base + `/playlists/${playlistID}/tracks`)
                .set('Authorization', `Bearer ${this.token}`)
                .then(res => {
                    resolve(res.body);
                })
                .catch(reject);
        });
    }
}

module.exports = Spotify;