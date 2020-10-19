const { app, BrowserWindow } = require('electron');

function createWindows() {
    let appWindow = new BrowserWindow({
        width: 1024,
        show: false,
        height: 1024,
        webPreferences: {
            devTools: false, //这个是开发者debug模式，改为false就不会再出现调试
            nodeIntegration: true,
            nodeIntegrationInWorker: true
        }
    });
    appWindow.setMenuBarVisibility(false);
    appWindow.loadFile('./index.html');

    appWindow.once('ready-to-show', () => {
        appWindow.show();
    });

    //open web developer tools when load the content.
    appWindow.webContents.openDevTools();
}

app.on('ready', createWindows);