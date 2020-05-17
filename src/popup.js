import { log } from './common.js'

var popupViews;

function uiSetCurrentView(view) {
    document.body.replaceChild(popupViews[view], document.body.firstChild);
    if (view == "dialog") {
        document.body.firstChild.firstChild.focus();
        document.body.firstChild.firstChild.value = "";
    }
}
function uiUpdateView(key, val) {
    popupViews[key] = val;
}
function uiCategoriesView(categories) {
    let categoriesList = document.createElement("ul");
    categoriesList.id = "categories-list";
    for (let element of categories) {
        let listItem = document.createElement("li");
        listItem.innerText = element;
        listItem.onclick = async function () {
            try {
                let results = await browser.runtime.sendMessage({ action: 'list_bookmarks', category: element });
                uiUpdateView("bookmarks", uiBookmarksView(element, results.bookmarks));
                uiSetCurrentView("bookmarks");
            } catch (error) {
                log(error);
            }
        };
        categoriesList.appendChild(listItem);
    }
    let newCategoryListItem = document.createElement("li");
    newCategoryListItem.innerText = "Add Category...";
    newCategoryListItem.id = "add-category";
    newCategoryListItem.onclick = function () {
        uiSetCurrentView("dialog");
    };
    categoriesList.appendChild(newCategoryListItem);
    return categoriesList;
}
function uiCreateButtonGroup(buttons) {
    let buttonBar = document.createElement("ul");
    buttonBar.className = "button-group";
    for (let item of buttons) {
        let button = document.createElement("li");
        button.innerText = item.title;
        button.onclick = item.onclick;
        button.className = "button";
        button.id = item.id;
        buttonBar.appendChild(button);
    }
    return buttonBar;
}
function uiNewCategoryView() {
    let entry = document.createElement("input");
    entry.attributes['type'] = "text";
    entry.style.display = "block";
    let okButton = {
        title: "OK",
        id: "ok",
        onclick: async function () {
            let newCategoryEntry = document.querySelector("input");
            let newCategoryName = newCategoryEntry.value;
            try {
                await browser.runtime.sendMessage({ action: "add_category", category: newCategoryName })
                let result = await browser.runtime.sendMessage({ action: "list_categories" });
                uiUpdateView("categories", uiCategoriesView(result.categories));
                uiSetCurrentView("categories");
            } catch (error) {
                log(error);
            }
        }
    };
    let cancelButton = {
        title: "Cancel",
        id: "cancel",
        onclick: function () {
            uiSetCurrentView("categories");
        }
    };
    let newCategoryView = document.createElement("div");
    newCategoryView.appendChild(entry);
    newCategoryView.appendChild(uiCreateButtonGroup([okButton, cancelButton]));
    newCategoryView.id = "new-category-dialog";
    return newCategoryView;
}
async function bookmarkHandler() {
    try {
        let category = this['data-category'];
        await browser.runtime.sendMessage({
            action: "remove_bookmark",
            url: this['data-url']
        });
        let results = await browser.runtime.sendMessage({
            action: "list_bookmarks",
            category
        });
        uiUpdateView("bookmarks", uiBookmarksView(category, results.bookmarks));
        uiSetCurrentView("bookmarks");
        browser.tabs.create({ url: this['data-url'] });
        window.close();
    } catch (error) {
        log(error);
    }
}
function uiBookmarksView(category, list) {
    let bookmarksView = document.createElement("div");
    bookmarksView.id = "bookmarks";
    let header = document.createElement("header");
    header.innerText = category;
    let bookmarksList = document.createElement("ul");
    bookmarksList.id = "bookmarks-list";
    for (let i = 0; i < list.length; i++) {
        let bookmarkListItem = document.createElement("li");
        bookmarkListItem.innerText = list[i].title;
        bookmarkListItem['data-url'] = list[i].url;
        bookmarkListItem['data-category'] = category;
        bookmarkListItem.onclick = bookmarkHandler;
        bookmarksList.appendChild(bookmarkListItem);
    }
    bookmarksView.appendChild(header);
    bookmarksView.appendChild(bookmarksList);
    return bookmarksView;
}
function currentView() {
    return document.body.firstChild.id;
}

window.addEventListener("message", (event) => {
    uiUpdateView("categories", uiCategoriesView(event.data.categories));
    if (currentView() == "categories-list") {
        uiSetCurrentView("categories");
    }
});
window.addEventListener('load', async (event) => {
    try {
        let results = await browser.runtime.sendMessage({ action: "list_categories" })
        popupViews = {
            bookmarks: null,
            categories: uiCategoriesView(results.categories),
            dialog: uiNewCategoryView(),
        };
        uiSetCurrentView("categories");
        let response = await browser.runtime.sendMessage({ action: 'auth_status' });
        if (!response.authenticated) {
            let loginButton = document.createElement("button");
            loginButton.innerText = "Login to Pocket";
            loginButton.onclick = function () {
                this.innerText = "Logging in...";
                this.disabled = true;
                browser.runtime.sendMessage({ action: 'authenticate' }).then(() => window.close(), (e) => log(e));
            };
            document.body.appendChild(loginButton);
        }
    } catch (error) {
        log(error);
    }
});
