import { log } from './common.js'
import { SyncManager, authenticate } from './sync.js'
import { BookmarkData } from './data.js'

class MenuManager {
    menuData;
    init(categories) {
        this.menuData = Array();
        browser.menus.create({
            id: 'tabstore',
            contexts: ['tab'],
            title: 'Store tab',
            documentUrlPatterns: ["<all_urls>"],
            visible: categories.length > 0
        });
        for (let item of categories) {
            this.add(item);
        }
    }
    add(category) {
        this.updateRootMenuVisibility(true);
        let id = browser.menus.create({
            contexts: ['tab'],
            title: category,
            parentId: 'tabstore',
            onclick: async function (info, tab) {
                let category = menuManager.category(info.menuItemId);
                await syncManager.addBookmark(category, tab.url, tab.title);
                browser.tabs.remove(tab.id);
            }
        });
        this.menuData.push({ id, "category": category });
    }
    remove(category) {
        let idx = this.menuData.findIndex(item => item.category == category);
        if (idx >= 0) {
            browser.menus.remove(this.menuData[idx].id);
            this.menuData.splice(idx, 1);
        }
        this.updateRootMenuVisibility(false);
    }
    updateRootMenuVisibility(visible) {
        if (this.menuData.length == 0) {
            browser.menus.update("tabstore", { visible: visible });
        }
    }
    category(id) {
        return this.menuData.find(item => item.id == id).category;
    }
}

var syncManager = new SyncManager();
var bookmarkData = new BookmarkData();
var menuManager = new MenuManager();

bookmarkData.loadOrInit().then(() => {
    syncManager.setData(bookmarkData);
    menuManager.init(syncManager.listCategories());
}, log);
Promise.all([syncManager.init(), authenticate(false)]).then(rescheduleSync, e => {
    if (e.message != "Requires user interaction") { log(e) }
});

function rescheduleSync(syncAgent) {
    syncManager.setAgent(syncAgent);
    browser.alarms.create("sync", { periodInMinutes: 1.0 });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name == "sync") {
        await syncManager.sync(bookmarkData, false);
        bookmarkData.save();
    }
})
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'authenticate': {
            if (!syncManager.isAuthenticated()) {
                return authenticate(true).then(rescheduleSync, log);
            }
            break;
        };
        case 'auth_status': {
            sendResponse({ authenticated: syncManager.isAuthenticated() });
            break;
        };
        case 'list_categories': {
            sendResponse({ categories: syncManager.listCategories() });
            break;
        };
        case 'list_bookmarks': {
            sendResponse({ bookmarks: syncManager.listBookmarks(message.category) });
            break;
        }
        case 'add_category': {
            menuManager.add(message.category);
            return syncManager.addCategory(message.category);
        }
        case 'remove_category': {
            menuManager.remove(message.category);
            syncManager.removeCategory(message.category);
            break;
        }
        case 'remove_bookmark': {
            syncManager.removeBookmark(message.url);
        }
    }
});
