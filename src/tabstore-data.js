import { log } from './tabstore-common.js'

export class BookmarkData {
    init() {
        this.data = new Object();
        this.data.categories = new Array();
        this.data.bookmarks = new Map();
    }
    loadOrInit() {
        return browser.storage.local.get("data").then((result) => {
            if (result.hasOwnProperty("data")) {
                this.data = result.data;
            } else {
                this.init();
            }
        }, log);
    }
    save() {
        return browser.storage.local.set(this.data);
    }
    categories() {
        return this.data.categories;
    }
    addCategory(category) {
        if (!this.data.categories.find(item => item == category)) {
            this.data.categories.push(category);
        }
    }
    removeCategory(category) {
        let idx = this.data.categories.findIndex(item == category);
        if (idx >= 0) {
            this.data.categories.splice(idx, 1);
            this.data.bookmarks.forEach((value, key, map) => {
                if (value.category == idx) {
                    map.delete(key);
                } else if (value.category > idx) {
                    map[key] = { category: value.category - 1, title: value.title }
                }
            })
        }
    }
    bookmarks(category) {
        let idx = this.data.categories.findIndex(item => item == category);
        let bookmarks = new Array();
        this.data.bookmarks.forEach((value, key, map) => {
            if (value.index == idx) {
                bookmarks.push({ url: key, title: value.title });
            }
        })
        return bookmarks;
    }
    addBookmark(category, url, title) {
        let idx = this.data.categories.findIndex(item => item == category);
        if (idx > -1) {
            this.data.bookmarks.set(url, { index: idx, title });
        }
    }
    removeBookmark(url) {
        this.data.bookmarks.delete(url);
    }
}