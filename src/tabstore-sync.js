import { log } from './tabstore-common.js'

export class SyncManager {
    constructor() {
        this.syncItems = new Array();
        this.added = new Object();
        this.deleted = new Array();
        this.categories = new Array();
    }
    async init() {
        let result = await browser.storage.local.get("pocket");
        if (result.hasOwnProperty("pocket")) {
            this.syncItems = result.pocket.syncItems;
            this.categories = result.pocket.categories;
        }
    }
    isAuthenticated() {
        return this.syncAgent != undefined;
    }
    setAgent(syncAgent) {
        this.syncAgent = syncAgent;
    }
    setData(data) {
        this.bookmarkData = data;
    }
    async sync() {
        if (this.deleted.length > 0 || Object.entries(this.added).length > 0) {
            let now = new Date();
            let syncItems = await this.syncAgent.modify({ items: this.deleted, time: now.getTime() }, this.added);
            Array.prototype.push.apply(this.syncItems, syncItems);
            this.deleted = new Array();
            this.added = new Object();
        }
        for (let i = 0; i < this.categories.length; i++) {
            this.updateBookmarkData(i);
        }
        this.bookmarkData.save();
        browser.storage.local.set({ pocket: { syncItems: this.syncItems, categories: this.categories } });
    }
    async updateBookmarkData(categoryIndex) {
        let category = this.categories[categoryIndex].category;
        let since = this.categories[categoryIndex].since;
        let results = await this.syncAgent.get(category, since);
        for (let id of results.deleted) {
            let idx = this.syncItems.findIndex(item => item.id == id);
            if (idx > -1) {
                let url = this.syncItems[idx].url;
                this.syncItems.splice(idx, 1);
                this.bookmarkData.removeBookmark(url);
            }
        }
        let toPush = new Array();
        for (let item of results.new) {
            this.bookmarkData.addBookmark(category, item.url, item.title);
            if (!this.syncItems.find(syncItem => syncItem.url == item.url)) {
                toPush.push({ id: item.id, url: item.url });
            }
        }
        Array.prototype.push.apply(this.syncItems, toPush);
        this.categories[categoryIndex].since = results.since;
    }
    removeBookmark(url) {
        this.bookmarkData.removeBookmark(url);
        this.bookmarkData.save();
        let idx = this.syncItems.findIndex(item => item.url == url);
        if (idx > -1) {
            let id = this.syncItems[idx].id;
            this.syncItems.splice[idx, 1];
            this.deleted.push(id);
        } else {
            for (let key of Object.keys(this.added)) {
                let idx = this.added[key].findIndex(item => item.url == url)
                if (idx > -1) {
                    this.added[key].splice(idx, 1);
                }
            }
        }
    }
    addBookmark(category, url, title, time) {
        this.bookmarkData.addBookmark(category, url, title);
        this.bookmarkData.save();
        if (!this.added.hasOwnProperty(category)) {
            this.added[category] = new Array();
        }
        let item = this.syncItems.find(item => item.url == url);
        if (item) {
            let deleted_idx = this.deleted.findIndex(id => id == item.id);
            if (deleted_idx) {
                this.deleted.splice(this.deleted_idx, 1);
            }
        } else {
            this.added[category].push({ url, title, time });
        }
    }
    listBookmarks(category) {
        return this.bookmarkData.bookmarks(category);
    }
    addCategory(category) {
        if (!this.categories.find(item => item.category == category)) {
            this.bookmarkData.addCategory(category);
            let idx = this.categories.length;
            let since = 0;
            this.categories.push({ category, since });
            if (this.isAuthenticated()) {
                return this.updateBookmarkData(idx).finally(() => this.bookmarkData.save());
            } else {
                this.bookmarkData.save();
            }
        }
    }
    listCategories() {
        return this.bookmarkData.categories();
    }
    removeCategory(category) {
        this.bookmarkData.listCategory(category).forEach(item => this.removeBookmark(item.url))
        this.bookmarkData.removeCategory(category);
        let idx = this.categories.findIndex(item => item.category == category);
        if (idx >= 0) {
            this.categories.splice(idx, 1);
        }
        this.bookmarkData.save();
    }
}

export async function authenticate(interactive) {
    let redirect_uri = browser.identity.getRedirectURL();
    let headers = {
        "Content-Type": "application/json",
        "X-Accept": "application/json",
    };
    let response = await fetchData("POST", "oauth/request", { redirect_uri: encodeURIComponent(redirect_uri) }, headers);
    let params = { request_token: response.code, redirect_uri };
    let url = "https://getpocket.com/auth/authorize?" + buildQuery(params);
    await browser.identity.launchWebAuthFlow({ url: url, interactive: interactive });
    response = await fetchData("POST", "oauth/authorize", { code: response.code }, headers);
    return new SyncAgent(response.access_token);
}
class SyncAgent {
    constructor(accessToken) {
        this.accessToken = accessToken;
    }
    async get(category, since) {
        let params = { since, 'tag': category, 'detail_type': 'simple', access_token: this.accessToken };
        let data = await fetchData("GET", "get", params);
        let items = Object.values(data.list);
        let newItems = items.filter(item => item.status == 0).map((item) => {
            return { id: item.item_id, url: item.given_url, title: item.given_title }
        });
        let deletedItems = items.filter(item => item.status == 2).map(item => item.item_id);
        return { new: newItems, deleted: deletedItems, since: data.since };
    }
    async modify(toDelete, toAdd) {
        let deleteActions = toDelete.items.map(id => ({ action: "delete", item_id: id, time: toDelete.time }));
        let addActions = Object.entries(toAdd).flatMap(entry => entry[1].map(item => {
            return { action: "add", tags: entry[0], time: item.time, title: item.title, url: item.url, item_id: "" }
        }));
        let params = { access_token: this.accessToken, actions: JSON.stringify(deleteActions.concat(addActions)) };
        let response = await fetchData("GET", "send", params);
        return response.action_results.map(item => ({ id: item.item_id, url: item.given_url }));
    }
}
function buildQuery(params) {
    let entries = Object.entries(params);
    let query = entries[0][0] + "=" + encodeURIComponent(entries[0][1]);
    for (let i = 1; i < entries.length; i++) {
        query += '&' + entries[i][0] + '=' + encodeURIComponent(entries[i][1]);
    }
    return query;
}
async function fetchData(method, path, params, headers) {
    const pocketUrl = "https://getpocket.com/v3/";
    const consumerKey = "91051-c961081e51a646c93a62a92a";
    let init = {
        method: method,
        mode: "cors",
        cache: "default",
        credentials: "include",
    };
    if (headers) {
        init.headers = headers;
    }
    params['consumer_key'] = consumerKey;
    let url = pocketUrl + path + "?" + buildQuery(params);
    let response = await fetch(url, init);
    if (!response.ok) {
        let errorMessage = response.status + " " + response.statusText;
        if (response.headers["X-Error"] != null) {
            errorMessage = ":" + response.headers["X-Error"];
        }
        throw new Error(errorMessage);
    }
    return response.json();
}