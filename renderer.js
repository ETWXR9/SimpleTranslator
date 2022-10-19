const remote = require('@electron/remote');
try {
    // Depends on tencentcloud-sdk-nodejs version 4.0.3 or higher
    var tencentcloud = require("tencentcloud-sdk-nodejs");
    var fs = require("fs");
    var clipboardListener = require('clipboard-event');
    var { clipboard } = require("electron");
    var textHandler = require((remote.app.isPackaged ? remote.process.env.PORTABLE_EXECUTABLE_DIR + "\\" : ".\\") + "textHandler");
    var { winuser, process } = require('easywin');
    var crypto = require("crypto");
    var fetch = require('node-fetch');
    var { URLSearchParams } = require('url');
    var child_process = require("child_process");

} catch (error) {
    alert(error);
    remote.app.quit();
}






//翻译状态
/** @type {Array<{source:string,local:{source:string,result:string},numberMatch:string[]}>} */
let translateQueue = [];
let apiTranslateAvailable = true;
let isTranslating = false;
let numberFilter = true;
/** @type {number}
 *  0:clipborad
 *  1:textractor
 */
let translateMode = 0;

//提取器
/** @type {Textractor} */
let textractorCLI32;
let textractorCLI64;
let textractorCLI32Process;
let currentHookPid;
let currentHookhWnd;
//endwith下列文本的pid进程路径的窗口从窗口选择列表中移除
const windowFilter = [
    "C:\\Windows\\explorer.exe",
    "TextInputHost.exe",
    "ShellExperienceHost.exe",
    "SearchApp.exe",
    "StartMenuExperienceHost.exe",
    "SystemSettings.exe",
    "ApplicationFrameHost.exe",
]

//config
let rootDir;
/** @type {{tencentId:string,tencentKey:string,baiduId:string,baiduKey:string}} 
 * tencentId
 * tencentKey
*/
let config = {};
/**
 * @type {{name:string,api:string,source:string,target:string,gamePath:string,hooks:string[],sourceHandler:Array}} gameConfig 游戏设置
 * @type {string} gameConfig.name 游戏名称
 * @type {string} gameConfig.api 使用的翻译api
 * @type {string} gameConfig.source 源语言
 * @type {string} gameConfig.target 目标语言
 * @type {string} gameConfig.gamePath 游戏路径
 * @type {Array} gameConfig.hooks 程序文本hook，handle
 * @type {Array} gameConfig.sourceHandler 文本处理，{functionName,args}
 * 
*/
let gameConfig = {}
/** 
 * @type {{mapping:{source:string,result:string}[], termMapping:Array<{source:string,result:string}>}}
 * {source:result}
 * 储存翻译结果
 */
let gameData = {
    mapping: [],
    termMapping: []
}

//#region 设置窗口元素
let configWindow;
let configWindowBW;
//game栏
/** @type {HTMLInputElement} */
let gamejsoninput
/** @type {HTMLInputElement} */
let gamenameinput;
/** @type {HTMLInputElement} */
let apiinput;
/** @type {HTMLInputElement} */
let frominput;
/** @type {HTMLInputElement} */
let toinput;
/** @type {HTMLSelectElement} */
let processselect;
/** @type {HTMLDivElement} */
let processtextdiv;
/** @type {HTMLDivElement} */
let sourcehandlerdiv;
/** @type {HTMLButtonElement} */
let addsourcehandlerbtn;
/** @type {HTMLInputElement} */
let intervalinput;
/** @type {HTMLDivElement} */
let handlertestsourcediv;
/** @type {HTMLDivElement} */
let handlertestresultdiv;

//config 栏
let tencentidinput;
let tencentkeyinput;
let testtencentbtn;
let baiduidinput;
let baidukeyinput;
let testbaidubtn;


//#endregion 设置窗口元素

//#region 翻译窗口元素
let translateWindowBW;
/** @type {HTMLDivElement} */
let gamenamediv;
/** @type {HTMLDivElement} */
let translatestatdiv;
/** @type {HTMLDivElement} */
let savetranslatediv;
/** @type {HTMLDivElement} */
let retranslatediv
/** @type {HTMLDivElement} */
let configdiv;
/** @type {HTMLDivElement} */
let closediv;
/** @type {HTMLTextAreaElement} 
 *  @type {string}translatesourcediv.localText
*/
let translatesourcediv;
/** @type {HTMLDivElement}
 *  @type {string}translateresultdiv.localText
 */
let translateresultdiv;
/** @type {HTMLDivElement} */
let starttranslatediv;
/** @type {HTMLDivElement} */
let termdiv;
/** @type {HTMLDivElement} */
let termsourcediv;
/** @type {HTMLInputElement} */
let terminput;
/** @type {HTMLDivElement} */
let termdeletediv;
//#endregion 翻译窗口元素

let CHILDP_TEMP = [];

window.onload = () => {

    rootDir = remote.app.isPackaged ? remote.process.env.PORTABLE_EXECUTABLE_DIR + "/" : "";
    console.log("apppath = " + remote.app.getAppPath());
    //注册F12
    window.addEventListener("keydown", e => {
        if (e.key == "F12") {
            remote.BrowserWindow.getFocusedWindow().webContents.openDevTools();
        }
    })

    //#region configWindow
    configWindow = window.open("config.html", "设置窗口", ``);
    configWindowBW = remote.BrowserWindow.getAllWindows()[0];
    configWindowBW.webContents.openDevTools();
    configWindow.onload = function () {
        configWindow.addEventListener("keydown", e => {
            if (e.key == "F12") {
                remote.BrowserWindow.getFocusedWindow().webContents.openDevTools();
            }
        })
        //#region game栏
        gamenameinput = configWindow.document.getElementById("gamenameinput");
        apiinput = configWindow.document.getElementById("apiinput");
        frominput = configWindow.document.getElementById("sourceinput");
        processselect = configWindow.document.getElementById("processselect");
        processtextdiv = configWindow.document.getElementById("processtextdiv");
        toinput = configWindow.document.getElementById("targetinput");
        intervalinput = configWindow.document.getElementById("intervalinput");
        sourcehandlerdiv = configWindow.document.getElementById("sourcehandlerdiv")
        //打开gamejson配置
        gamejsoninput = configWindow.document.getElementById("gamejsoninput");
        gamejsoninput.addEventListener("click", e => {
            e.preventDefault();
            // console.log((remote.app.isPackaged ? remote.process.env.PORTABLE_EXECUTABLE_DIR + "\\" : "") + "game\\");
            const optionsLoad = {
                title: "读取游戏配置",
                defaultPath: (remote.app.isPackaged ? remote.process.env.PORTABLE_EXECUTABLE_DIR + "\\" : "") + "game\\",
                multiSelections: false,
            }
            let result = remote.dialog.showOpenDialogSync(configWindowBW, optionsLoad);
            if (result) {
                console.log("打开文件" + result)
                loadGame(result[0]);
            }

        });
        //保存并终止翻译
        configWindow.document.getElementById("savegamejsonbtn").addEventListener("click", e => {
            saveGame()
            // if (isTranslating) {
            //     startTranslate();
            //     alert("已保存！请重新开始翻译");
            // }
        });
        //程序选择
        let defaultop = configWindow.document.createElement("option");
        defaultop.className = "processoption";
        defaultop.value = "null";
        defaultop.innerText = "不选程序，从剪贴板读取文本";
        processselect.appendChild(defaultop);
        defaultop.selected = true;
        processselect.addEventListener("focus", e => {
            console.log("focusonselect,生成程序列表");
            let allhWnd = winuser.EnumDesktopWindows();
            let allWindowTitles = [];
            allhWnd.forEach(hwnd => {
                if (!winuser.IsWindowVisible(hwnd)) return;
                if (!winuser.IsWindowEnabled(hwnd)) return;
                let title = winuser.GetWindowText(hwnd);
                if (!title) return;
                let winpid = winuser.GetWindowThreadProcessId(hwnd).ProcessId;
                if (windowFilter.find(s => process._filePathFromProcessId(winpid).endsWith(s))) return;
                let winobj = {
                    "title": title,
                    "hWnd": hwnd,
                    "pid": winpid
                }
                allWindowTitles.push(winobj);
            })
            processselect.innerHTML = "";
            let pleaseChoose = configWindow.document.createElement("option");
            pleaseChoose.className = "processoption";
            pleaseChoose.value = "null";
            pleaseChoose.innerText = "请选择";
            processselect.appendChild(pleaseChoose);
            let defaultop = configWindow.document.createElement("option");
            defaultop.className = "processoption";
            defaultop.value = "null";
            defaultop.innerText = "不选程序，从剪贴板读取文本";
            processselect.appendChild(defaultop);
            allWindowTitles.forEach(w => {
                let op = configWindow.document.createElement("option");
                op.className = "processoption";
                op.value = w.pid;
                op.innerText = w.title;
                //把title,hWnd,pid都存进去
                op.winobj = w;
                processselect.appendChild(op);
            })
        })
        processselect.addEventListener("change", e => {
            processselect.blur();
            //空则detach、清空hook栏、切换模式
            console.log("change!to" + processselect.value)
            if (processselect.value == "null") {
                textractorCLI32Process.stdin.write(Buffer.from("detach -P" + currentHookPid + "\n", "utf16le"));
                currentHookPid = null;
                currentHookhWnd = null;
                processtextdiv.innerHTML = "";
                translateMode = 0;
                return;
            }
            console.log("选择程序pid " + processselect.value);
            attachProcess(processselect.selectedOptions[0].winobj);
            translateMode = 1;
        })
        //文本处理项的添加
        addsourcehandlerbtn = configWindow.document.getElementById("addsourcehandlerbtn");
        addsourcehandlerbtn.addEventListener("click", e => addSourceHandlerItem())
        //文本处理测试栏
        handlertestsourcediv = configWindow.document.getElementById("handlertestsourcediv");
        handlertestresultdiv = configWindow.document.getElementById("handlertestresultdiv");
        //测试栏功能1.剪贴板更新
        clipboardListener.on('change', () => {
            if (translateMode == 1) return;
            let text = clipboard.readText();
            handlertestsourcediv.innerText = text;
            //处理
            if (gameConfig.sourceHandler) {
                gameConfig.sourceHandler.forEach(handler => {
                    text = textHandler[handler.functionName](text, ...handler.args);
                })
            }
            handlertestresultdiv.innerText = text;
        });
        //#endregion game栏

        //#region config栏
        //腾讯翻译
        tencentidinput = configWindow.document.getElementById("tencentidinput");
        tencentkeyinput = configWindow.document.getElementById("tencentkeyinput");
        tencentidinput.addEventListener("change", e => {
            config.tencentId = e.target.value;
            saveConfig();
        })
        tencentkeyinput.addEventListener("change", e => {
            config.tencentKey = e.target.value;
            saveConfig();
        })
        testtencentbtn = configWindow.document.getElementById("testtencentbtn");
        testtencentbtn.addEventListener("click", e => {
            tencentTrans("hello,world!", true).then(result => {
                let a = result.text ? alert("成功！") : alert(result.error);
            })
        })
        //百度翻译
        baiduidinput = configWindow.document.getElementById("baiduidinput");
        baidukeyinput = configWindow.document.getElementById("baidukeyinput");
        baiduidinput.addEventListener("change", e => {
            config.baiduId = e.target.value;
            saveConfig();
        })
        baidukeyinput.addEventListener("change", e => {
            config.baiduKey = e.target.value;
            saveConfig();
        })
        testbaidubtn = configWindow.document.getElementById("testbaidubtn");
        testbaidubtn.addEventListener("click", e => {
            baiduTrans("hello,world!", true).then(result => { let a = result.text ? alert("成功！") : alert(result.error) });
        })
        loadConfig();
        //#endregion config栏

        configWindowBW.webContents.closeDevTools();
    }
    //#endregion configWindow

    //#region 翻译窗口
    translateWindowBW = remote.BrowserWindow.getAllWindows()[1];
    // console.log("translateWindowBW " + remote.BrowserWindow.getAllWindows()[1].webContents.getTitle());
    gamenamediv = document.getElementById("gamenamediv");
    translatesourcediv = document.getElementById("translatesourcediv");
    starttranslatediv = document.getElementById("starttranslatediv");
    savetranslatediv = document.getElementById("savetranslatediv")
    translateresultdiv = document.getElementById("translateresultdiv")
    translatestatdiv = document.getElementById("translatestatdiv");
    retranslatediv = document.getElementById("retranslatediv");
    configdiv = document.getElementById("configdiv");
    closediv = document.getElementById("closediv");
    termdiv = document.getElementById("termdiv");
    termsourcediv = document.getElementById("termsourcediv");
    terminput = document.getElementById("terminput");
    termdeletediv = document.getElementById("termdeletediv");
    resizeTo(screen.width * 0.3, screen.height * 0.3);
    // translateWindowBW.setAspectRatio(2)
    moveTo(screen.width * 0.7, 0);
    //剪贴板更新事件
    clipboardListener.on('change', () => {
        if (isTranslating && translateMode == 0) {
            intoTranslateQueue({ text: clipboard.readText() });
        }
    });
    //翻译开始暂停
    starttranslatediv.addEventListener("click", e => {
        if (!gameConfig.name) {
            alert("无游戏加载！请前往设置窗口加载游戏");
            return;
        }
        startTranslate();
    })
    //翻译修改保存
    savetranslatediv.addEventListener("click", e => {
        saveToData(translatesourcediv.localText, translateresultdiv.innerText)
        translatestatdiv.innerText = "已保存当前翻译";
    })
    //重新翻译
    retranslatediv.addEventListener("click", e => {
        intoTranslateQueue({ text: translatesourcediv.innerText, froceAPI: true });
    })
    //打开设置窗口
    configdiv.addEventListener("click", e => {
        if (configdiv.innerText == "打开设置") {
            configWindowBW.show();
            configdiv.innerText = "关闭设置";
        } else
            if (configdiv.innerText == "关闭设置") {
                configWindowBW.hide();
                configdiv.innerText = "打开设置";
            }
    })
    //术语功能
    translatesourcediv.addEventListener("keydown", e => {
        // e.preventDefault();
        // console.log(`ctrl:${e.ctrlKey},key:${e.key}`);
        if (e.ctrlKey && e.key == "d") {
            if (!isTranslating) return;
            let selectedTerm = window.getSelection().toString();
            // console.log(`selectedTerm:${selectedTerm}`);
            if (!selectedTerm) return;
            // console.log("选择术语" + selectedTerm);
            termdiv.style.display = "flex";
            termsourcediv.innerText = "将" + selectedTerm + " 翻译为";
            terminput.value = "";
            //用于保存
            termsourcediv.sourceTerm = selectedTerm;
            let existedTerm = gameData.termMapping.find(item => { return item.source == selectedTerm })
            if (existedTerm) {
                console.log("找到existedTerm=" + existedTerm.source + ":" + existedTerm.result);
                terminput.value = existedTerm.result;
            }
            terminput.focus();
        }
    })
    //删除术语按钮
    termdeletediv.addEventListener("click", function tempDelete(e) {
        e.preventDefault();
        let existedTerm = gameData.termMapping.find(item => { return item.source == termsourcediv.sourceTerm })
        // console.log("删除术语时，找到存在术语" + existedTerm);
        if (existedTerm) {
            // gameData.termMapping.remove(existedTerm);
            //因为序号不能变，所以不能直接移除
            existedTerm.result = "";
            translatestatdiv.innerText = "术语已删除";
            retranslatediv.dispatchEvent(new Event("click"));
        } else {
            translatestatdiv.innerText = "该术语不存在";
        }
        termdiv.style.display = "none";
    });
    //回车&esc
    terminput.addEventListener("keydown", (e) => {
        if (e.keyCode === 13) {
            e.preventDefault();
            let text = terminput.value;
            let transResult = "";
            let selectedTerm = termsourcediv.sourceTerm;
            //判空
            if (text == "") {
                transResult = selectedTerm;
            } else {
                transResult = text;
            }
            let existedTerm = gameData.termMapping.find(item => { return item.source == selectedTerm })
            if (existedTerm) {
                existedTerm.result = transResult;
            } else {
                gameData.termMapping.push({ source: selectedTerm, result: transResult });
            }
            translatestatdiv.innerText = `术语${selectedTerm}:${transResult}已保存`;
            console.log(`术语${selectedTerm}:${transResult}已保存`);
            termdiv.style.display = "none";
            retranslatediv.dispatchEvent(new Event("click"));
        }
        else if (e.keyCode === 27 && !terminput.readOnly) {
            e.preventDefault();
            termdiv.style.display = "none";
        }
    });
    termdiv.addEventListener("blur", e => {
        termdiv.display = "none";
    })
    //退出逻辑，保存人物JSON，保存内容
    closediv.addEventListener("click", e => {
        // alert("savegamedata!" + gameData.length);
        saveGameData(gameConfig.name);
        remote.app.exit();
    })
    translateWindowBW.on("close", e => {
        saveGameData(gameConfig.name);
        alert("save!")
        remote.app.exit();
    })
    //#endregion 翻译窗口

    //开始监听
    clipboardListener.startListening();
    initTextractorCLI((remote.app.isPackaged ? remote.process.env.PORTABLE_EXECUTABLE_DIR + "/" : remote.app.getAppPath() + "/") + "textractor\\x86\\");
    //关闭dev
    translateWindowBW.webContents.closeDevTools();
}


//#region config
function saveConfig() {
    fs.writeFileSync(rootDir + "config.json", JSON.stringify(config));
}
function loadConfig() {
    try {
        let configString = fs.readFileSync(rootDir + "config.json");
        if (configString) {
            config = JSON.parse(configString);
        }
    } catch (error) {
        config = {};
        config.tencentId = "";
        config.tencentKey = "";
    }
    //填充config栏
    tencentidinput.value = config.tencentId;
    tencentkeyinput.value = config.tencentKey;
    baiduidinput.value = config.baiduId;
    baidukeyinput.value = config.baiduKey;


}
function saveGame() {
    gameConfig = {}

    gameConfig.name = gamenameinput.value;
    if (!gameConfig.name) {
        alert("没有指定游戏名称！")
        return;
    }
    gameConfig.api = apiinput.value;
    gameConfig.source = frominput.value;
    if (!gameConfig.source) {
        alert("请输入源语言，如en、ja，注意不同api的语言简写不同");
        return;
    }
    gameConfig.target = toinput.value;
    if (!gameConfig.target) {
        alert("请输入目标语言，如zh，还是说你打算翻译成其他语言？");
        return;
    }
    if (processselect.value != "null") {
        gameConfig.gamePath = process._filePathFromProcessId(Number.parseInt(processselect.value));
        gameConfig.hooks = [];
        processtextdiv.childNodes.forEach(n => {
            if (n.selected) {
                gameConfig.hooks.push(n.ctx);
            }
        })
    }
    gameConfig.sourceHandler = []
    sourcehandlerdiv.childNodes.forEach(item => {
        if (item.className != "sourcehandleritem") return;
        let obj = {}
        obj.functionName = "";
        obj.args = [];
        item.childNodes.forEach(n => {
            if (n.className == "handlerselect") {
                obj.functionName = n.value;
            }
            if (n.className == "handlerargumentinput") {
                obj.args.push(n.value);
            }
        })
        gameConfig.sourceHandler.push(obj);
    })
    gameConfig.interval = intervalinput.value;
    fs.writeFileSync(rootDir + "game/" + gameConfig.name + ".json", JSON.stringify(gameConfig));

    gamenamediv.innerText = gameConfig.name;

}
function loadGame(gamepath) {
    gameConfig = {}
    try {
        gameConfig = JSON.parse(fs.readFileSync(gamepath));
    } catch (error) {
        console.error(error);
        return;
    }
    gamenameinput.value = gameConfig.name;
    apiinput.value = gameConfig.api;
    frominput.value = gameConfig.source;
    toinput.value = gameConfig.target;
    sourcehandlerdiv.innerHTML = "";
    //窗口进程信息
    if (gameConfig.gamePath) {
        processselect.dispatchEvent(new Event("focus"));
        let gameFound = false;
        for (let i = 0; i < processselect.options.length; i++) {
            const option = processselect.options[i];
            if (process._filePathFromProcessId(Number.parseInt(option.value)) == gameConfig.gamePath) {
                //匹配成功
                gameFound = true;
                option.selected = true;
                translateMode = 1;
                processselect.dispatchEvent(new Event("change"));
                //#region 复制自textractor的output事件
                //目前版本只支持翻译一个hook
                let ctx = gameConfig.hooks[0];
                console.log("创建hooktextdiv ctx= " + e.ctx);
                /** @type {HTMLDivElement} */
                let newTextDiv = configWindow.document.createElement("div");
                newTextDiv.className = "hooktextdiv";
                newTextDiv.ctx = ctx;
                //点击文本框后改变背景色，记录到元素属性中，有记录的元素点了后复原
                newTextDiv.addEventListener("click", e => {
                    if (newTextDiv.selected) {
                        newTextDiv.style.backgroundColor = "white"
                        newTextDiv.selected = false;
                    } else {
                        newTextDiv.style.backgroundColor = "rgba(235,142,183)"
                        newTextDiv.selected = true;
                        processtextdiv.childNodes.forEach(n => {
                            if (n == newTextDiv) return;
                            n.style.backgroundColor = "white"
                            n.selected = false;
                        })
                    }
                })
                newTextDiv.dispatchEvent(new Event("click"));
                processtextdiv.appendChild(newTextDiv);
                //#endregion 复制自textractor的output事件
            }
        }
        if (!gameFound) alert("未检测到程序" + gameConfig.gamePath + "请打开游戏后再加载游戏设置");
    }

    gameConfig.sourceHandler.forEach(handler => {
        addSourceHandlerItem(handler.functionName, handler.args);
    });

    intervalinput.value = gameConfig.interval;
    //读取翻译数据
    try {
        gameData = JSON.parse(fs.readFileSync(rootDir + "gameData/" + gameConfig.name + ".json"));
    } catch (error) {
        console.log("读取翻译结果出错，初始化");
        gameData.mapping = [];
        gameData.termMapping = [];
    }

    gamenamediv.innerText = gameConfig.name;
}
function saveGameData(gameName) {
    if (gameName) {
        fs.writeFileSync(rootDir + "gameData/" + gameName + ".json", JSON.stringify(gameData));
    }
}
function addSourceHandlerItem(fName, args) {
    //创建源文本处理规则
    let sourcehanlderitem = document.createElement("div");
    sourcehanlderitem.className = 'sourcehandleritem';
    sourcehandlerdiv.appendChild(sourcehanlderitem);
    //函数选择
    let handlerselect = document.createElement("select");
    sourcehanlderitem.appendChild(handlerselect);
    //填充选项
    Object.keys(textHandler).forEach(k => {
        let f = textHandler[k];
        if (typeof f == "function") {
            let opt = document.createElement("option");
            opt.value = k;
            opt.innerText = k;
            handlerselect.add(opt);
        }
    });
    handlerselect.className = "handlerselect";
    if (fName) {
        console.log("存在选择函数！设置选项" + fName);
        handlerselect.value = fName;
        // handlerselect.innerText = fName;
    }
    //删除
    let deletehandlerbtn = document.createElement("button");
    deletehandlerbtn.className = "dhandlerselecteletehandlerbtn";
    deletehandlerbtn.innerText = "删除";
    deletehandlerbtn.addEventListener("click", e => {
        //删除逻辑
        sourcehandlerdiv.removeChild(sourcehanlderitem);
    })
    sourcehanlderitem.appendChild(deletehandlerbtn);

    // handlerselect.addEventListener("focus", e => {
    //     handlerselect.innerHTML = "";

    // })
    //刷新参数input的内部函数(从第二个参数开始生成参数input)
    let createArgInput = function (a) {
        // console.log("生成opt")
        let f = textHandler[handlerselect.value];
        if (typeof f == "function") {
            //清空
            let clearArray = []
            sourcehanlderitem.childNodes.forEach(n => { if (n.className == "handlerargumentinput") clearArray.push(n) });
            clearArray.forEach(n => n.remove())
            for (let i = 1; i < f.length; i++) {
                let ainput = document.createElement("input");
                ainput.className = "handlerargumentinput";
                ainput.type = "text";
                if (a) {
                    ainput.value = a[i - 1];
                }
                sourcehanlderitem.insertBefore(ainput, deletehandlerbtn);
            }
        }
    }
    createArgInput();
    //如果args不为空，则直接生成input
    if (args) {
        createArgInput(args);
    }
    //选择函数后添加input
    handlerselect.addEventListener("change", e => {
        createArgInput();
    })

}
//#endregion config

//#region 翻译函数
/**
 *腾讯提供的翻译函数，返回promise函数出结果后调用outputResult函数
 *
 * @param {*} text
 * @returns {Promise}
 */
function tencentTrans(text, froceAPI = false) {
    const TmtClient = tencentcloud.tmt.v20180321.Client;

    // 实例化一个认证对象，入参需要传入腾讯云账户secretId，secretKey,此处还需注意密钥对的保密
    // 密钥可前往https://console.cloud.tencent.com/cam/capi网站进行获取
    const clientConfig = {
        credential: {
            secretId: config.tencentId,
            secretKey: config.tencentKey,
        },
        region: "ap-beijing",
        profile: {
            httpProfile: {
                endpoint: "tmt.tencentcloudapi.com",
            },
        },
    };

    // 实例化要请求产品的client对象,clientProfile是可选的
    const client = new TmtClient(clientConfig);
    const params = {
        "SourceText": text,
        "Source": froceAPI ? "en" : gameConfig.source,
        "Target": froceAPI ? "zh" : gameConfig.target,
        "ProjectId": 0
    };

    return new Promise((resolve, reject) => {
        client.TextTranslate(params).then(
            (data) => {
                // console.log("翻译成功！" + data.TargetText)
                resolve({ text: data.TargetText });
                // outputResult(true, data.TargetText, text);
            },
            (err) => {
                resolve({ error: err });
                // outputResult(false, err)
                // alert("翻译失败！" + err)
            }
        )
    })
}

function baiduTrans(text, forceAPI = false) {
    let salt = Date.now();
    const params = new URLSearchParams();
    params.append('q', text);
    params.append('from', forceAPI ? "en" : gameConfig.source);
    params.append('to', forceAPI ? "zh" : gameConfig.target);
    params.append('appid', config.baiduId);
    params.append('salt', salt);
    const md5 = crypto.createHash("md5");
    params.append('sign', md5.update(config.baiduId + text + salt + config.baiduKey).digest("hex"));
    return new Promise((resolve, reject) => {
        fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).then(res => res.json())
            .then(
                (data) => {
                    if (data.trans_result) {
                        let text = "";
                        for (let i = 0; i < data.trans_result.length; i++) {
                            const re = data.trans_result[i];
                            text = text + i > 0 ? "\n" : "" + re.dst;
                        }
                        resolve({ text: text });
                    } else {
                        resolve({ error: data.error_msg });
                    }
                }
            )
    })

}


//#endregion 翻译函数

//#region 文本提取
/**
 *  打开CLI并监听输出进行处理和翻译（向测试栏和翻译队列提供）
 *  
 * @param {*} path x86路径
 * @return {import('child_process').ChildProcessByStdio}
 */
function initTextractorCLI(path) {
    console.log("启动子进程");
    textractorCLI32Process = child_process.spawn("TextractorCLI.exe", {
        cwd: path,
        stdio: ["pipe", "pipe", "ignore"]
    });
    textractorCLI32Process.stdout.setEncoding("utf16le");
    console.log(textractorCLI32Process);

    //处理textractorCLI的输出
    textractorCLI32Process.stdout.on('data', function onstdout(data) {
        //解析数据
        //["handle":"pid","addr","ctx","ctx2","name","code"] "text"
        /** @type {IterableIterator<RegExpMatchArray>} */
        let infoMatch = data.matchAll(/\[.+:.+:.+:.+:.+:.+:.+\]/g);
        let infoArray = []
        for (const match of infoMatch) {
            infoArray.push(match[0]);
        }
        /** @type {Array<string>} */
        let textArray = data.split(/\[.+:.+:.+:.+:.+:.+:.+\]/g);
        for (let i = 0; i < infoArray.length; i++) {
            let info = infoArray[i];
            let text = textArray[i + 1];
            /** @type {{handle:string,pid:number,addr:string,ctx:string,ctx2:string,name:string,code:string,text:string}} */
            let output = {}
            let infoObjArray = info.substring(1).split(":");
            output.handle = infoObjArray[0];
            output.pid = Number.parseInt(infoObjArray[1], 16);
            output.addr = infoObjArray[2];
            output.ctx = infoObjArray[3];
            output.ctx2 = infoObjArray[4];
            output.name = infoObjArray[5];
            output.code = infoObjArray[6];
            //消除]后面的一个空格
            output.text = text.substring(1);
            console.log("Textractor Output");
            console.log(output);
            textractorOutput(output);
        }

    });
    /**
     *  子函数，处理文本并提供给测试栏、翻译函数
     *  
     * @param {{handle:string,pid:number,addr:string,ctx:string,ctx2:string,name:string,code:string,text:string}} e
     * @return {*} 
     */
    function textractorOutput(e) {
        if (e.pid != currentHookPid) return;
        // console.log("当前pid输出了文字！" + e.text);
        //hook栏存在该handle则直接更新文本
        let existedNode = Array.from(processtextdiv.childNodes).find(node => {
            return node.ctx === e.ctx
        });
        if (existedNode) {
            existedNode.innerText = e.text;
        }
        //没有则创建该ctx对应的hooktextdiv
        else {
            console.log("创建hooktextdiv ctx= " + e.ctx);
            /** @type {HTMLDivElement} */
            let newTextDiv = configWindow.document.createElement("div");
            newTextDiv.className = "hooktextdiv";
            newTextDiv.ctx = e.ctx;
            newTextDiv.innerText = e.text;
            //点击文本框后改变背景色，记录到元素属性中，有记录的元素点了后复原
            newTextDiv.addEventListener("click", e => {
                if (newTextDiv.selected) {
                    newTextDiv.style.backgroundColor = "white"
                    newTextDiv.selected = false;
                } else {
                    newTextDiv.style.backgroundColor = "rgba(235,142,183)"
                    newTextDiv.selected = true;
                    processtextdiv.childNodes.forEach(n => {
                        if (n == newTextDiv) return;
                        n.style.backgroundColor = "white"
                        n.selected = false;
                    })
                }
            })
            processtextdiv.appendChild(newTextDiv);
        }
        //文本处理和翻译
        if (isTranslating && translateMode == 1 && (gameConfig.hooks ? gameConfig.hooks.indexOf(e.ctx) != -1 : false)) {
            intoTranslateQueue({ text: e.text, index: gameConfig.hooks.indexOf(e.ctx) });
        }
        //测试栏
        if (translateMode == 1 && (gameConfig.hooks ? gameConfig.hooks.indexOf(e.ctx) != -1 : false)) {
            let text = e.text
            handlertestsourcediv.innerText = e.text;
            //处理
            if (gameConfig.sourceHandler) {
                gameConfig.sourceHandler.forEach(handler => {
                    text = textHandler[handler.functionName](text, ...handler.args);
                })
            }
            handlertestresultdiv.innerText = text;
        }
    }

    textractorCLI32Process.stdin.write(Buffer.from("attach -P10568" + "\n", "utf16le"));
}

/**
 *  textractor挂载指定pid
 *
 * @param {{pid:number,hwnd:string,title,string}} winobj 
 * @return {*} 
 */
function attachProcess(winobj) {
    let pid = winobj.pid;
    let hWnd = winobj.hWnd;
    let title = winobj.title;
    try {
        console.log("检查当前句柄窗口" + currentHookhWnd);
        console.log(winuser.GetWindowThreadProcessId(currentHookhWnd))
        if (winuser.GetWindowThreadProcessId(currentHookhWnd).ThreadId != 0) {
            textractorCLI32Process.stdin.write(Buffer.from("detach -P" + currentHookPid + "\n", "utf16le"));
            currentHookPid = null;
            currentHookhWnd = null;
            console.log("detach" + currentHookPid);
            // console.log("attachedPID = "textractorCLI32.attached)
        }
    } catch (error) {
        console.log("无currentHookPid！" + error);
    }
    try {
        currentHookPid = pid;
        currentHookhWnd = hWnd;
        processtextdiv.innerHTML = "";
        textractorCLI32Process.stdin.write(Buffer.from("attach -P" + pid + "\n", "utf16le"));
        console.log("attachPID " + pid);
        alert("挂载成功！");
    } catch (error) {
        alert("挂载程序失败！");
        processselect.selectedIndex = 1;
        processselect.dispatchEvent(new Event("change"));
        console.log("attach" + pid + "失败");
        console.log(error);
        return;
    }
}

//#endregion 文本提取

//#region 文本处理
/**
 *
 *  打开/关闭翻译，开启后开始监听剪贴板
 * @param {*} start 是开启还是关闭
 */
function startTranslate() {
    let startbtn = starttranslatediv;
    if (startbtn.innerText == "开始翻译") {
        startbtn.innerText = "暂停翻译";
        isTranslating = true;

    } else {
        startbtn.innerText = "开始翻译";
        isTranslating = false;
    }
}

/**
 * 将文本和其他信息传入翻译列表
 *
 * @param {{text: string,index?:number,froceAPI?:boolean}} transObj
 * @return {*} 
 */
function intoTranslateQueue(transObj) {
    let text = transObj.text;
    if (translateQueue.length > 5) {
        return null;
    }
    //自定义函数处理
    gameConfig.sourceHandler.forEach(handler => {
        text = textHandler[handler.functionName](text, ...handler.args);
    })
    //数字过滤(本地存过滤后的结果)
    if (numberFilter) {
        let numberReg = /[0-9]+/g;
        let matchResult = text.matchAll(numberReg);
        var numberMatch = [];
        for (const item of matchResult) {
            numberMatch.push(item[0]);
        }
        // console.log("在文本 " + text + " 中找到数字" + numberMatch);
        text = text.replace(numberReg, "284503");
    }
    //本地匹配
    let localData = transObj.froceAPI ? undefined : gameData.mapping.find(item => { return item.source == text });
    //术语过滤(本地存过滤前的结果)
    gameData.termMapping.forEach((termMap, index) => {
        //result为空意为删除
        if (!termMap.result) return;
        let reg = new RegExp(termMap.source, "g");
        //术语全部过滤为CAK-术语序号-AKC
        text = text.replace(reg, `CAK-${index}-AKC`);
        // console.log(`术语过滤后为${text}`);
    })
    // console.log("检索本地翻译库" + gameData)
    translateQueue.push({ local: localData ? localData : false, source: text, numberMatch: numberMatch })
    translateNext();
}
/**
 * 选择翻译方式，调用不同的翻译函数
 *
 * 
 * @return {*} 
 */
function translateNext() {
    if (translateQueue.length == 0) {
        console.log("队列清空，结束翻译")
        return;
    }
    let item = translateQueue[0];
    if (!item.source) {
        console.log("翻译对象为空文本，删除")
        translateQueue.shift();
        return;
    }

    //本地
    if (item.local) {
        console.log("提取本地数据并继续翻译队列")
        //用于保存修改时调用的本地数据，为数字还原前的
        translatesourcediv.localText = item.local.source.slice();
        translateresultdiv.localText = item.local.result.slice();
        //还原数字(不用还原术语，因本地存的是还原后的)
        item.local.source = resumeNumber(item.local.source);
        item.local.result = resumeNumber(item.local.result);
        //输出文本到翻译窗口
        translatesourcediv.innerText = item.local.source;
        translateresultdiv.innerText = item.local.result;
        translatestatdiv.innerText = "本地数据";
        translateQueue.shift();
        translateNext()
        return;
    }
    //本地无数据，使用api翻译
    if (apiTranslateAvailable) {
        //检查在线翻译状态
        if (!apiTranslateAvailable) {
            return;
        }
        //根据api选择翻译并处理返回的Promise<{}>
        /** @type {Promise<{text:string,error:string}>} */
        let resultPromise;
        switch (gameConfig.api) {
            case "tencent":
                console.log("使用腾讯翻译翻译文本：" + item.source);
                resultPromise = tencentTrans(item.source);
                break;
            case "baidu":
                console.log("使用百度翻译翻译文本：" + item.source);
                resultPromise = baiduTrans(item.source);
                break;
            default:
                break;
        }
        apiTranslateAvailable = false;
        //对翻译结果进行处理
        resultPromise.then((result) => {
            //错误则直接输出
            if (result.error) {
                item.source = resumeTerm(item.source, "source");
                let source = resumeNumber(item.source);
                translatesourcediv.innerText = source;
                translateresultdiv.innerText = result.error;
                translatestatdiv.innerText = "api翻译错误！";
            }
            //正确则输出并保存
            else {
                //还原术语
                item.source = resumeTerm(item.source, "source");
                result.text = resumeTerm(result.text, "result");
                //记录到本地（术语还原后，数字还原前）
                // console.log("调用saveResult时原文" + item.source);
                // console.log("调用saveResult时译文" + result.text);
                let saveSource = item.source.slice()
                let saveResult = result.text.slice()
                saveToData(saveSource, saveResult)
                //用于保存修改时调用的本地数据，为数字还原前的
                translateresultdiv.localText = saveSource;
                translateresultdiv.localText = saveResult;
                //还原数字
                item.source = resumeNumber(item.source);
                result.text = resumeNumber(result.text);
                //输出文本到翻译窗口
                // console.log("输出时保存原文" + item.source);
                translatesourcediv.innerText = item.source;

                translateresultdiv.innerText = result.text;

                translatestatdiv.innerText = "api翻译并保存";
                translateQueue.shift();

                //发送API请求并开始等待翻译间隔
            }
            setTimeout(() => {
                //等待完毕，继续翻译队列
                apiTranslateAvailable = true;
                translateNext();
            }, gameConfig.interval ? Math.max(200, gameConfig.interval) : 200)
        });

    } else {
        return;
    }
    /**
     * @param {string} text
     * @return {string} 
     */
    function resumeNumber(text) {
        let result = text;
        //如果原文中就存在285403，每有一次就将替换位后移
        let coincidenceAmount = 1;
        for (let i = 0; i < item.numberMatch.length; i++) {
            const d = item.numberMatch[i];
            result = replaceNthMatch(result, "284503", coincidenceAmount, d);
            if (d == "284503") {
                coincidenceAmount++;
            }
        }
        return result;
    }
    /**
     * @param {string} text
     * @param {string} mode 只能是"result"或"source"
     * @return {string} 
     */
    function resumeTerm(text, mode) {
        let result = text;
        for (const item of result.matchAll(/CAK-[0-9\s]*-AKC/ig)) {
            let reg = new RegExp(item[0], "g");
            // console.log("替换源" + item[0]);
            // console.log("替换项目" + gameData.termMapping[Number.parseInt(item[0].match(/[0-9]+/)[0])][mode]);
            let index = Number.parseInt(item[0].match(/[0-9\s]+/)[0].replace(/\s/, ""));
            result = result.replace(reg, gameData.termMapping[index][mode]);
        }
        return result;
    }
}

function saveToData(source, result) {
    let found = gameData.mapping.find(item => { return item.source == source });
    if (found) {
        found.result = result;
    } else {
        gameData.mapping.push({ source: source, result: result });
    }
}

//#endregion 文本处理

//#region 其他函数
/**
 * replaceNthMatch
 * @param {string} original
 * @param {RegExp|string} pattern reg
 * @param {number} n from 1
 * @param {string} replace 
 * @return {string} 
 */
var replaceNthMatch = function (original, pattern, n, replace) {
    var parts, tempParts;

    if (pattern.constructor === RegExp) {

        // If there's no match, bail
        if (original.search(pattern) === -1) {
            return original;
        }

        // Every other item should be a matched capture group;
        // between will be non-matching portions of the substring
        parts = original.split(pattern);

        // If there was a capture group, index 1 will be
        // an item that matches the RegExp
        if (parts[1].search(pattern) !== 0) {
            throw { name: "ArgumentError", message: "RegExp must have a capture group" };
        }
    } else if (pattern.constructor === String) {
        parts = original.split(pattern);
        // Need every other item to be the matched string
        tempParts = [];

        for (var i = 0; i < parts.length; i++) {
            tempParts.push(parts[i]);

            // Insert between, but don't tack one onto the end
            if (i < parts.length - 1) {
                tempParts.push(pattern);
            }
        }
        parts = tempParts;
    } else {
        throw { name: "ArgumentError", message: "Must provide either a RegExp or String" };
    }

    // Parens are unnecessary, but explicit. :)
    var indexOfNthMatch = (n * 2) - 1;

    if (parts[indexOfNthMatch] === undefined) {
        // There IS no Nth match
        return original;
    }

    if (typeof (replace) === "function") {
        // Call it. After this, we don't need it anymore.
        replace = replace(parts[indexOfNthMatch]);
    }

    // Update our parts array with the new value
    parts[indexOfNthMatch] = replace;

    // Put it back together and return
    return parts.join('');

}
/**
 * Remove item
 * @name Array#remove
 */
Array.prototype.remove = function (item) {
    var index = this.indexOf(item);
    if (index > -1) {
        this.splice(index, 1);
    }
};


//#endregion 其他函数