import { log } from './tabstore-common.js'

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
function createEmpty() {
    let empty = document.createElement("li");
    empty.id = "empty";
    empty.innerText = "Empty";
    return empty;
}
function uiCategoriesView(categories) {
    let categoriesView = document.createElement("div");
    categoriesView.id = "categories-view";
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
    if (categories.length == 0) {
        categoriesList.appendChild(createEmpty());
    }
    categoriesView.appendChild(categoriesList);
    let addCategory = document.createElement("a");
    addCategory.innerText = "Add Category...";
    addCategory.id = "add-category";
    addCategory.addEventListener("click", () => uiSetCurrentView("dialog"));
    categoriesView.appendChild(addCategory);
    browser.runtime.sendMessage({ action: 'auth_status' }).then(response => {
        if (!response.authenticated) {
            let loginButton = document.createElement("a");
            loginButton.id = "auth-btn";
            loginButton.onclick = function () {
                browser.runtime.sendMessage({ action: 'authenticate' }).then(() => window.close(), log);
            };
            categoriesView.appendChild(loginButton);
        }
    });
    return categoriesView;
}
function uiNewCategoryView() {
    let newCategoryView = document.createElement("form");
    newCategoryView.id = "new-category-dialog";
    newCategoryView.addEventListener("submit", async () => {
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
    });
    let entry = document.createElement("input");
    entry.id = "entry";
    entry.type = "text";
    newCategoryView.appendChild(entry);
    let submit = document.createElement("input");
    submit.value = "OK";
    submit.id = "ok";
    submit.type = "submit";
    submit.className = "button";
    newCategoryView.appendChild(submit);
    let cancel = document.createElement("input");
    cancel.type = "button";
    cancel.value = "Cancel";
    cancel.id = "cancel";
    cancel.className = "button";
    cancel.addEventListener("click", () => {
        uiSetCurrentView("categories");
    });
    newCategoryView.appendChild(cancel);
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
        bookmarkListItem.title = list[i].title;
        bookmarkListItem['data-url'] = list[i].url;
        bookmarkListItem['data-category'] = category;
        bookmarkListItem.onclick = bookmarkHandler;
        bookmarksList.appendChild(bookmarkListItem);
    }
    if (list.length == 0) {
        bookmarksList.appendChild(createEmpty());
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
    } catch (error) {
        log(error);
    }
});
