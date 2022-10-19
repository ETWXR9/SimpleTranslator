
const electron = require('electron')
const { ipcMain, app, BrowserWindow, clipboard, Menu, MenuItem, ipcRenderer, webContents, dialog, shell } = require('electron')
const path = require("path");
const fs = require("fs");
const remote = require('@electron/remote/main');


//设置窗口
let translateWin;
let configWin;
ipcMain.on("hideConfig", e => { configWin.hide(); })
ipcMain.on("showConfig", e => { configWin.show(); });
app.whenReady().then(() => {
    translateWin = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            worldSafeExecuteJavaScript: true,
            contextIsolation: false,
            nodeIntegration: true,
            enableRemoteModule: true,

        },
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        minHeight: electron.screen.getPrimaryDisplay().size.height * 0.2,
        minWidth: electron.screen.getPrimaryDisplay().size.width * 0.2,
        fullscreenable: false,

    })
    remote.initialize();
    remote.enable(translateWin.webContents);
    // win.hide();
    translateWin.webContents.openDevTools();
    translateWin.loadFile('translate.html').then(pro => {
        configWin = BrowserWindow.getAllWindows()[0];
        configWin.setAlwaysOnTop(true);
        configWin.setMenu(null);
        configWin.on("close", e => {
            // alert("asd");
            e.preventDefault();
            configWin.hide();
        });
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})
