import { log } from './tabstore-common.js'

export class BookmarkData {
    init() {
        this.data = new Object();
        this.data.categories = new Array();
        this.data.bookmarks = new Object();
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
        return browser.storage.local.set({ data: this.data });
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
            Object.entries(this.data.bookmarks).forEach(([key, value]) => {
                if (value.category == idx) {
                    delete this.data.bookmarks[key];
                } else if (value.category > idx) {
                    this.data.bookmarks[key] = { category: value.category - 1, title: value.title }
                }
            })
        }
    }
    bookmarks(category) {
        let idx = this.data.categories.findIndex(item => item == category);
        let bookmarks = new Array();
        Object.entries(this.data.bookmarks).forEach(([key, value]) => {
            if (value.category == idx) {
                bookmarks.push({ url: key, title: value.title });
            }
        })
        return bookmarks;
    }
    addBookmark(category, url, title) {
        let idx = this.data.categories.findIndex(item => item == category);
        if (idx > -1) {
            this.data.bookmarks[url] = { category: idx, title };
        }
    }
    removeBookmark(url) {
        this.data.bookmarks.delete(url);
    }
}