const request = require('superagent');
const base = 'https://api.soundcloud.com';

class SoundCloud {
    constructor(clientID) {
        this.clientID = clientID;
    }

    getUserTracks(userID) {
        return new Promise((resolve, reject) => {
            request
                .get(base + `/users/${userID}/tracks`)
                .query({
                    client_id: this.clientID
                })
                .then(res => {
                    resolve(res.body);
                })
                .catch(reject);
        });
    }

    resolve(url) {
        return new Promise((resolve, reject) => {
            request
                .get(base + '/resolve')
                .query({
                    url,
                    client_id: this.clientID
                })
                .then(res => {
                    resolve(res.body);
                })
                .catch(reject);
        });
    }
}

module.exports = SoundCloud;