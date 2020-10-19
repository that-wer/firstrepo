const os = require("os");
const isWin = (os.platform() == "win32");
const {
    saveLog
} = require("./saveLog");
window.Bootstrap = require('bootstrap');
window.$ = window.jQuery = require('jquery');
const appdata = require('electron').remote.app.getPath('userData');
var picsDir
if (isWin) {
    picsDir = appdata + "\\pics\\";
} else {
    picsDir = appdata + "/pics/";
}

var languageDetector = require("i18next-electron-language-detector").detect();
var i18next = require("i18next");
var jqueryI18next = require("jquery-i18next");


const STATE_CHECK = 0
const STATE_CONFIRM = 1
const BAD_POSE = 0
const GOOD_POSE = 1
const NOBODY_POSE = 2
var NO_DISTURB = true;
var ALERT_POPUP = true;

let startTime
var timer;
var times = 0;
let video;
let poseNet;
let pose;
let poses = [];
var started = false;
var notifySound;
let canvas;
var isModelReady = false;
var debug = false; //Only in debug mode the bad posture and the log will be saved.
var checkstate = STATE_CHECK;
let lastCaptureGoodTimestamp = 0;
let lastCaptureBadTimestamp = 0;
var recordgoodsection = 0; //记录good-posture的时间段
var recordgoodtimestart; //记录进入good-posture的时间点
var goodtimestart; //进入good-posture的时间点
var goodsection = 0; //good-posture的时间段

var all_time;
var show_percent_good = "N/A";
var show_percent_bad = "N/A";

var recordbadsection = 0; //记录bad的时间段
var recordbadtimestart; //记录进入bad的时间点
var badtimestart; //进入bad的时间点
var badsection = 0; //bad的时间段

var controlgood = 1; //记录时间段标记
var controlbad = 1; //记录时间段标记

var entergood = 0;
var enterbad = 0;

var goodtimer = 0; //正确次数
var badtimer = 0; //错误次数

var rightEye, leftEye, rightShoulder, leftShoulder, nose,
    distanceEye, defaultRightEyeYPosition = [],
    defaultLeftEyeXPosition = [],
    defaultRightEyeXPosition = [],
    defaultLeftEyePosition = [],
    defaultNoseYPosition = []
currentNoseYPosition = []; //将其整出来反而弄巧成拙，可以使得再5s加载中进行判断

let leftEyeScore, rightEyeScore, noseScore, noseYChange;

var defaultEyeDistance, currentEyeDistance, rightEyeYChange, eyeDistanceChangeThreshold, noseYDistanceChangeThreshold;

var posture; //current posture id
var scale;
let timeleft = 5; //count down for 3 seconds
//display the count down timer on the screen



function countdownTimer() {
    time = "N/A";
    show_percent_good = "N/A";
    show_percent_bad = "N/A";
    document.getElementById("goodtime").innerHTML = time;
    document.getElementById("goodpercentAge").innerHTML = show_percent_good;
    document.getElementById("badpercentAge").innerHTML = show_percent_bad;
    document.getElementById("mask_goodtime").innerHTML = time;
    document.getElementById("timer").innerHTML = time;
    document.getElementById("mask_timer").innerHTML = time;
    document.getElementById("badtime").innerHTML = time;
    document.getElementById("mask_badtime").innerHTML = time;
    let countdownTimer = setInterval(function() {

        $("#reminderText").addClass("alert-warning");
        $("#reminderText").removeClass("alert-danger");
        $("#reminderText").removeClass("alert-success");
        $("#reminderText").removeClass("alert-primary");
        $("#reminderText").html(i18next.t("countdown", {
            timer: timeleft
        }));
        started = true;
        if (timeleft <= 0) {
            show_popup();
            checkstate = STATE_CONFIRM;
            clearInterval(countdownTimer); //如果不清除，每隔一秒截一张图。

            $("#reminderText").addClass("alert-danger");
            $("#reminderText").removeClass("alert-success");
            $("#reminderText").removeClass("alert-primary");
            $("#reminderText").removeClass("alert-warning");
            $("#reminderText").html(i18next.t("working"));
            console.log("countdown done!");
            started = true;
            console.log("started");
            //init posture
            defaultRightEyeYPosition = [];
            defaultLeftEyeXPosition = [];
            defaultRightEyeXPosition = [];
            defaultLeftEyePosition = [];
            defaultNoseYPosition = [];
            posture = ""
            lastCaptureGoodTimestamp = 0;
            lastCaptureBadTimestamp = 0; //这里需要重新定义一下，不然不会显示的。这样5s后会重新截取好的
            console.log("finished count down")

            startTime = new Date(); //执行定时器的时间
            timer = setInterval(function() {
                time = "N/A";
                time = timeChange(all_time);
                document.getElementById("timer").innerHTML = time;
                document.getElementById("mask_timer").innerHTML = time;
                if (document.getElementById("ifClose").checked == true) { Change_no_disturb() }
                if (document.getElementById("ifClose").checked == false) {  NO_DISTURB = true; }
                if (document.getElementById("ifalertClose").checked == true) { Change_alert() }
                if (document.getElementById("ifalertClose").checked == false) {  ALERT_POPUP = true; }
            }, 1000)
        }
    }, 1000);
    loop();

}

function chcolor() {
    document.getElementById("backcolor").style.backgroundColor = '#880000';
}

function returncolor() {
    document.getElementById("backcolor").style.backgroundColor = '#333232';
}

function Change_no_disturb() {
    NO_DISTURB = false;
}
function Change_alert() {
    ALERT_POPUP = false;
}

function show_popup() {
    if (NO_DISTURB == true) {
        $('#No_disturb_Modal').modal();
    }
}

function show_alert() {
    if (ALERT_POPUP == true) {
        $('#alertModal').modal();
    }
}
//显示
function globalShade() {
    if (window.parent.document.getElementById('mask')) {
        window.parent.document.getElementById('mask').style.display = "block";
        window.parent.document.getElementById('backcolor').style.display = "none";
    }
};
//隐藏
function deleteGlobalShade() {
    if (window.parent.document.getElementById('mask')) {
        window.parent.document.getElementById('mask').style.display = "none";
        window.parent.document.getElementById('backcolor').style.display = "block";
    }
};
/////////////////////////
function preload() {
    let soundfile = [];
    soundfile[0] = '478262__tannersound__decline-buzz-beep.wav';
    soundfile[1] = '163459__littlebigsounds__lbs-fx-dog-small-alert-bark001.wav';
    soundfile[2] = '415209__inspectorj__cat-screaming-a.wav';

    let random;
    random = Math.floor(Math.random() * 4);
    console.log(soundfile[random]);
    notifySound = loadSound(soundfile[random]);

    // const languageDetector = new LanguageDetector();
    // console.log(languageDetector);

    i18next.init({
        debug: debug,
        lng: languageDetector,
        resources: {
            "en": {
                translation: {
                    "title": "Good Posture",
                    "mode": {
                        "loose": "Loose",
                        "general": "General",
                        "strict": "Strict"
                    },
                    "start": "Start",
                    "stop": "Stop",
                    "finish": "Finish",
                    "loading": "Loading Machine Learning Model...",
                    "prepare": "Maintain good posture after starting",
                    "good-posture-card-title": "Good posture",
                    "live-detection-card-title": "Live detection",
                    "face-missing": "Can not detect your face, make sure face is in the live detection window...",
                    "good-posture-detected": "Good posture determined, AI checking posture now...",
                    "countdown": "{{timer}} seconds to get your good posture",
                    "working": "Live posture detection is working.....",
                    "detect-time": "Detecting Time:",
                    "detect-times": "Last Times",
                    "right-time": "Right Posture:",
                    "error-time": "Wrong Posture:",
                    "no-disturb": "	No Distraction Mode",
                    "detect-content": "The screen will turn black when the undisturbed mode starts!",
                    "no-prompt": "No Reminder",
                    "no-close": "Cancel",
                    "no-ok": "Start",
                    "history-document": "Historical Record",
                    "exit-button": "Exit Mode",
                    "second": "s",
                    "minute": "m",
                    "hour": "h",
                    "day": "d",
                    "right-all-time": "Good posture percentage",
                    "creditModalLabel_history": "History",
                    "btn_close": "Close",
                    "alert-know": "OK",
                    "warm-prompt": "Tips：",
                    "just_relax": "Pay attention to the combination of work and rest! Have a rest",
                    "no-alert": "No Reminder",
                }

            },
            "zh": {
                translation: {
                    "title": "保持坐姿",
                    "mode": {
                        "loose": "宽松",
                        "general": "常规",
                        "strict": "严格",
                    },
                    "start": "开始",
                    "stop": "停止",
                    "loading": "正在加载机器学习模型...",
                    "prepare": "点击 开始 后，请保持正确坐姿",
                    "good-posture-card-title": "正确坐姿",
                    "live-detection-card-title": "实时检测",
                    "face-missing": "无法检测到人脸，请确保前置摄像头工作正常",
                    "good-posture-detected": "已获取正确坐姿，正在进行AI坐姿检测……",
                    "countdown": "请坐好啦！ {{timer}}秒后将获取正确坐姿",
                    "working": "AI坐姿检测工作中，请尽量与正确坐姿保持一致",
                    "detect-time": "检测时间:",
                    "detect-times": "检测次数",
                    "right-time": "正确坐姿:",
                    "error-time": "错误坐姿:",
                    "no-disturb": "免打扰模式",
                    "detect-content": "免打扰模式开始后，屏幕将变黑！",
                    "no-prompt": "不再提示",
                    "no-close": "取消",
                    "no-ok": "免打扰模式",
                    "history-document": "历史纪录",
                    "exit-button": "退出免打扰",
                    "second": "秒",
                    "minute": "分",
                    "hour": "时",
                    "day": "天",
                    "right-all-time": "姿势正确率",
                    "creditModalLabel_history": "历史纪录",
                    "btn_close": "关闭",
                    "alert-know": "我知道了",
                    "warm-prompt": "温馨提示：",
                    "just_relax": "注意劳逸结合哦！休息一下吧",
                    "no-alert": "不再提示",

                }
            }
        }
    }, function(err, t) {
        // initialized and ready to go!做好所有准备，调用摄像头等。
        jqueryI18next.init(i18next, $);
        $("#title").localize();
        $("#detectMode").localize();
        $("#startbutton").localize();
        $("#reminderText").html(i18next.t("prepare"));
        $("#live-detection-card-text").localize();
        $("#good-posture-card-text").localize();
        $("#detect-time").localize();
        $("#right-time").localize();
        $("#error-time").localize();
        $("#detects-time").localize();
        $("#rights-time").localize();
        $("#errors-time").localize();
        $("#no-disturb").localize();
        $("#history").localize();
        $("#myModalLabel").localize();
        $("#detect-content").localize();
        $("#no-prompt").localize();
        $("#no-close").localize();
        $("#no-ok").localize();
        $("#exit-button").localize();
        $("#title_history").localize();
        $("#btn-close").localize();
        $("#alert-know").localize();
        $("#warm-prompt").localize();
        $("#just_relax").localize();
        $("#no-alert").localize();
        // $("#detectMode input:radio")[0].localize();
        //这里获取的是你想要全球化文字的id;
    });
}

function timeChange(totalTime) {
    var days = parseInt(totalTime / parseInt(1000 * 60 * 60 * 24));
    totalTime = totalTime % parseInt(1000 * 60 * 60 * 24);
    var hours = parseInt(totalTime / parseInt(1000 * 60 * 60));
    totalTime = totalTime % parseInt(1000 * 60 * 60);
    var minutes = parseInt(totalTime / parseInt(1000 * 60));
    totalTime = totalTime % parseInt(1000 * 60);
    var seconds = parseInt(totalTime / parseInt(1000));
    var time = "";
    if (days >= 1) {
        time = days + i18next.t("day") + hours + i18next.t("hour") + minutes + i18next.t("minute") + seconds + i18next.t("second");
    } else if (hours >= 1) {
        time = hours + i18next.t("hour") + minutes + i18next.t("minute") + seconds + i18next.t("second");
    } else if (minutes >= 1) {
        time = minutes + i18next.t("minute") + seconds + i18next.t("second");
    } else {
        time = seconds + i18next.t("second");
    } 
    return time;
}

function changePercentAge(partChild, partMother) { //传入时间分子和时间分母
    let millisecond = (partChild / 1000).toFixed(0) / (partMother / 1000).toFixed(0);
    millisecond = millisecond.toFixed(2);
    return toPercent(millisecond); //返回百分比字符串
}

function setup() {
    console.log("debug", debug);

    if (!isModelReady) {
        // $('#startbutton').text('Loading Machine Learning Model...');
        $("#startbutton").text(i18next.t("loading"));
    }

    const fs = require("fs"); // Or `import fs from "fs";` with ESM

    if (!fs.existsSync(picsDir)) {
        fs.mkdirSync(picsDir);
    }
    console.log(picsDir, fs.existsSync(picsDir));

    saved = false;
    canvas = createCanvas(640, 480); // or use to make fullscreen canvas window.innerWidth, window.innerHeight, but you should to change the formula in changeFontSize()

    // set id for the canvas
    canvas.id("videoCanvas");

    canvas.parent('videoContainer');

    //Only to use the face front camera
    var constraints = {
        audio: false,
        video: {
            facingMode: "user"
        }
    };

    // Video capture 
    video = createCapture(constraints);
    video.size(width, height);
    console.log("width:", width, "height:", height);
    //video.size(640,480);

    if (video == true) {
        console.log('true');
    }

    // Create a new poseNet method with a single detection
    poseNet = ml5.poseNet(video, modelReady);
    // This sets up an event that fills the global variable "poses"
    // with an array every time new poses are detected
    poseNet.on('pose', function(results) {
        poses = results;

    });

    // Hide the video element, and just show the canvas
    video.hide(); //其实下面还有一个窗口，只不过隐藏了。
    noLoop();
}


// This function turns on AI
function start() {
    // console.log($('#detectMode input:radio:checked').val())
    switch ($('#detectMode input:radio:checked').val()) {
        case "0":
            scale = 0.8;
            break;
        case "1":
            scale = 0.5;
            break;
        case "2":
            scale = 0.3;
    }

    console.log("Scale", scale)

    if ($('#startbutton').text() == i18next.t("start")) {
        console.log("start()");
        $('#startbutton').text(i18next.t("stop"));
        // if (started == false) {
        countdownTimer();
        // }
    } else {
        stop();
    }
}

// This function stops the experiment
function stop() {
    var total_Time = new Date() - startTime;
    saveCsv((new Date()).getTime(), goodsection, badsection, total_Time)
    noLoop();
    clearInterval(timer);
    recordgoodsection = 0; //记录good-posture的时间段
    goodsection = 0; //good-posture的时间段
    recordbadsection = 0; //记录bad的时间段
    badsection = 0; //bad的时间段
    checkstate = STATE_CHECK; //如果去掉会直接抓拍
    timeleft = 5; //以上这两个都是加上去的
    controlgood = 1; //记录时间段标记
    controlbad = 1; //记录时间段标记
    entergood = 0;
    enterbad = 0;
    console.log("stop");

    $('#startbutton').text(i18next.t("start"));

    $("#reminderText").addClass("alert-primary");
    $("#reminderText").removeClass("alert-danger");
    $("#reminderText").removeClass("alert-success");
    $("#reminderText").removeClass("alert-warning");
    $("#reminderText").html(i18next.t("prepare"));

    $("#dectection-card").addClass("bg-dark");
    $("#dectection-card").removeClass("bg-danger");
    $("#dectection-card").removeClass("bg-success");

    started = false;


}

//play sound
function playSound() {
    chcolor(); //改变面打扰模式背景颜色
    if (!notifySound.isPlaying()) {
        // .isPlaying() returns a boolean
        notifySound.play();
    }
}

function toPercent(data) {
    var strData = (data) * 100;
    var ret = strData.toFixed(0).toString() + "%";
    return ret;
}

function stopPlayingSound() {
    returncolor(); //恢复免打扰模式背景颜色
    if (notifySound.isPlaying()) {
        console.log("now stopping sound")
        notifySound.stop();
    }
}
var lastgoodtime;

function draw() {
    // console.log("draw()")
    if (started) {
        var nowTime = new Date(); //当前时间
        var sTime = new Date(startTime); //开始时间
        var totalTime = nowTime.getTime() - sTime.getTime(); //时间差
        if(parseInt(totalTime/(1000*60))>=30 && parseInt(totalTime/(1000*60))%30==0 && parseInt(totalTime/1000)%60==0 ){
            show_alert();
        }
        all_time = new Date(totalTime);
        switch (checkstate) {
            case STATE_CONFIRM:
                {
                    image(video, 0, 0, width, height); //这里就是将video传到右边那个框里
                    // console.log("finished count down")
                    switch (drawEyes()) {
                        case GOOD_POSE:
                            {
                                all_time = new Date(totalTime);
                                time = timeChange(all_time);
                                if (time == NaN) { //未获取到检测时间显示N/A
                                    time = "N/A";
                                }

                                goodtimestart = new Date();
                                if (entergood == 1) {
                                    recordbadsection = badsection;
                                    entergood == 0;
                                }
                                if (controlgood == 1) {
                                    recordgoodtimestart = goodtimestart;
                                    controlgood = 0;
                                }
                                goodsection = recordgoodsection + goodtimestart.getTime() - recordgoodtimestart.getTime();
                                var time = timeChange(goodsection);
                                console.log('goodsection', goodsection);

                                document.getElementById("goodtime").innerHTML = time;
                                document.getElementById("mask_goodtime").innerHTML = time;
                                //百分比计算  start
                                show_percent_bad = changePercentAge(badsection, all_time);
                                show_percent_good = changePercentAge(goodsection, all_time);
                                //百分比计算 end
                                document.getElementById("goodpercentAge").innerHTML = show_percent_good;
                                document.getElementById("badpercentAge").innerHTML = show_percent_bad;
                                enterbad = 1;
                                controlbad = 1;
                                stopPlayingSound();
                                $("#reminderText").removeClass("alert-primary");
                                $("#reminderText").removeClass("alert-danger");
                                $("#reminderText").addClass("alert-success");
                                $("#reminderText").removeClass("alert-warning");

                                $("#dectection-card").removeClass("bg-dark");
                                $("#dectection-card").removeClass("bg-danger");
                                $("#dectection-card").addClass("bg-success");
                                $("#reminderText").html(i18next.t("good-posture-detected"));
                                if (debug) {
                                    saveGoodPostureLog(pose, posture);
                                }
                                break;
                            }
                        case NOBODY_POSE:
                            {
                                all_time = new Date(totalTime)
                                time = timeChange(all_time);
                                if (time == NaN) { //未获取到检测时间显示N/A
                                    time = "N/A";
                                }
                                if (enterbad == 1) {
                                    recordgoodsection = goodsection;
                                    enterbad == 0;
                                }
                                badtimestart = new Date();
                                if (controlbad == 1) {
                                    recordbadtimestart = badtimestart;
                                    controlbad = 0;
                                }
                                badsection = recordbadsection + badtimestart.getTime() - recordbadtimestart.getTime();
                                var time = timeChange(badsection);
                                document.getElementById("badtime").innerHTML = time;
                                document.getElementById("mask_badtime").innerHTML = time;
                                //百分比计算  start
                                show_percent_bad = changePercentAge(badsection, all_time);
                                show_percent_good = changePercentAge(goodsection, all_time);
                                //百分比计算 end
                                document.getElementById("badpercentAge").innerHTML = show_percent_bad;
                                document.getElementById("goodpercentAge").innerHTML = show_percent_good;
                                entergood = 1;
                                controlgood = 1;
                                $("#reminderText").removeClass("alert-primary");
                                $("#reminderText").addClass("alert-danger");
                                $("#reminderText").removeClass("alert-success");
                                $("#reminderText").removeClass("alert-warning");
                                $("#reminderText").html(i18next.t("face-missing"));
                                break;
                            }
                        case BAD_POSE:
                            {
                                all_time = new Date(totalTime)
                                time = timeChange(all_time); //未获取到检测时间显示N/A
                                if (time == NaN) {
                                    time = "N/A";
                                }
                                if (enterbad == 1) {
                                    recordgoodsection = goodsection;
                                    enterbad == 0;
                                }
                                badtimestart = new Date();
                                if (controlbad == 1) {
                                    recordbadtimestart = badtimestart;
                                    controlbad = 0;
                                }
                                badsection = recordbadsection + badtimestart.getTime() - recordbadtimestart.getTime();
                                var time = timeChange(badsection);
                                document.getElementById("badtime").innerHTML = time;
                                document.getElementById("mask_badtime").innerHTML = time;
                                //百分比计算  start
                                show_percent_bad = changePercentAge(badsection, all_time);
                                show_percent_good = changePercentAge(goodsection, all_time);
                                //百分比计算 end
                                document.getElementById("badpercentAge").innerHTML = show_percent_bad;
                                document.getElementById("goodpercentAge").innerHTML = show_percent_good;
                                entergood = 1;
                                controlgood = 1;
                                playSound();
                                $("#dectection-card").removeClass("bg-dark");
                                $("#dectection-card").addClass("bg-success");
                                $("#dectection-card").addClass("bg-danger");
                                if (debug) {
                                    saveBadPostureLog(pose, posture);
                                }
                                break;
                            }
                    }
                    break;
                }
            case STATE_CHECK:
                {
                    //image(video, 0, 0, width, height);//这里就是将video传到右边那个框里
                    switch (drawEyes()) {
                        case GOOD_POSE:
                            {
                                if (lastgoodtime == undefined) {
                                    lastgoodtime = new Date();
                                }
                                if ((new Date() - lastgoodtime) / 1000 > 1) {
                                    timeleft -= 1;
                                    lastgoodtime = new Date();
                                }
                                break;
                            }
                        case NOBODY_POSE:
                        case BAD_POSE:
                            {
                                timeleft = 5;
                                defaultNoseYPosition = [];
                            }
                    }
                }
        }
    }
}

function modelReady() {
    console.log('model loaded');
    isModelReady = true;
    $('#startbutton').text(i18next.t("start"));


}

// A function to draw ellipses over the detected keypoints
function drawEyes() {
    // Loop through all the poses detected
    let state;

    try {
        //in case the pose undefined.

        pose = poses[0].pose;

        if (poses.length > 1) {
            //pick up the high score pose
            for (let i = 1; i < poses.length; i++) {
                // For each pose detected, loop through all the pose
                if (poses[i].pose.keypoints[0].score > pose.keypoints[0].score && poses[i].pose.keypoints[1].score > pose.keypoints[1].score && poses[i].pose.keypoints[2].score > pose.keypoints[2].score) {
                    //determine which pose has the hightest score
                    pose = pose[i];
                }
            }
        }


        // A keypoint is an object describing a body part (like rightArm or leftShoulder)
        rightEyeScore = pose.keypoints[2].score;
        leftEyeScore = pose.keypoints[1].score;
        noseScore = pose.keypoints[0].score;


        if (rightEyeScore < 0.6 && leftEyeScore < 0.6 && noseScore < 0.6) {

            // not able to detect face
            state = NOBODY_POSE;

        } else {

            rightEye = pose.keypoints[2].position;
            leftEye = pose.keypoints[1].position;
            nose = pose.keypoints[0].position;

            rightShoulder = pose.keypoints[6].position;
            leftShoulder = pose.keypoints[5].position;


            // draw the key points on the canvas
            // drawKeypoints();
            // drawSkeleton();

            if (defaultNoseYPosition.length < 1) {
                defaultNoseYPosition.push(nose.y);
                defaultRightEyeXPosition.push(rightEye.x);
                defaultLeftEyeXPosition.push(leftEye.x);
                defaultLeftEyePosition.push(leftEye.y);

                defaultEyeDistance = defaultLeftEyeXPosition[0] - defaultRightEyeXPosition[0];
                eyeDistanceChangeThreshold = defaultEyeDistance * 0.1;
                noseYDistanceChangeThreshold = defaultEyeDistance * scale;

                if (debug) {
                    posture = saveGoodPostureLog(pose, posture);
                } else {
                    posture = saveGoodPosture();
                }
                console.log("posture", posture)
            }

            $("#good-posture").attr('src', picsDir + posture);
            $("#good-posture_mask").attr('src', picsDir + posture);

            noseYChange = nose.y - defaultNoseYPosition[0];
            currentEyeDistance = leftEye.x - rightEye.x;

            if (noseYChange > noseYDistanceChangeThreshold) {

                state = BAD_POSE;
            } else {

                state = GOOD_POSE;
            }
        }
        return state;

    } catch (err) {
        console.log(err);
    }
}


// save the video picture to the folder /pics
function saveVideoPicture(path) {
    var videoCanvas = document.getElementById("videoCanvas");
    const url = videoCanvas.toDataURL('image/jpg', 0.8);
    const base64Data = url.replace(/^data:image\/png;base64,/, "");
    var fs = require('fs');
    // console.log(base64Data);
    fs.writeFile(path, base64Data, 'base64', function(err) {
        console.log(err);
    });
}


//建立计数csv文件
function saveCsv(CurrentTime, goodpositionTime, badpositionTime, allTime) {
    //save the log file to the disk
    const fs = require('fs');
    var csvWriter = require('csv-write-stream');
    var writer = csvWriter({
        sendHeaders: false
    }); //Instantiate var
    var csvFilename = "CountTime.csv";

    // If CSV file does not exist, create it and add the headers
    if (!fs.existsSync(csvFilename)) {
        writer = csvWriter({
            sendHeaders: false
        });
        writer.pipe(fs.createWriteStream(csvFilename));
        writer.write({
            header0_0: 'CurrentTime',
            header0_1: 'goodpositionTime',
            header0_2: 'badpositionTime',
            header0_3: 'allTime',
        });
        writer.end();
    }
    // Append some data to CSV the file    
    writer.pipe(fs.createWriteStream(csvFilename, {
        flags: 'a'
    }));
    if(allTime>=60000)//if alltime is less than 60s,the data won't be recorded
        {
            writer.write({
                header0_0: CurrentTime,
                header0_1: goodpositionTime / 1000,
                header0_2: badpositionTime / 1000,
                header0_3: allTime / 1000,
            });
        }
    writer.end();
}

// A function to draw ellipses over the detected keypoints
function drawKeypoints() {
    // Loop through all the poses detected
    for (let i = 0; i < poses.length; i++) {
        // For each pose detected, loop through all the keypoints
        let pose = poses[i].pose;
        for (let j = 0; j < pose.keypoints.length; j++) {
            // A keypoint is an object describing a body part (like rightArm or leftShoulder)
            let keypoint = pose.keypoints[j];
            // Only draw an ellipse is the pose probability is bigger than 0.2
            if (keypoint.score > 0.2) {
                fill(255, 0, 0);
                noStroke();
                ellipse(keypoint.position.x, keypoint.position.y, 10, 10);
            }
        }
    }
}

// A function to draw the skeletons
function drawSkeleton() {
    // Loop through all the skeletons detected
    for (let i = 0; i < poses.length; i++) {
        let skeleton = poses[i].skeleton;
        // For every skeleton, loop through all body connections
        for (let j = 0; j < skeleton.length; j++) {
            let partA = skeleton[j][0];
            let partB = skeleton[j][1];
            stroke(255, 0, 0);
            line(partA.position.x, partA.position.y, partB.position.x, partB.position.y);
        }
    }
}

function saveGoodPosture() {
    let timestamp = new Date().getTime();
    let filename = 'good_posture_' + timestamp.toString() + '.jpg';
    let path = picsDir + filename;
    saveVideoPicture(path);
    return filename;
}

// save good posture picture as a baseline
function saveGoodPostureLog(pose, _posture) {
    let timestamp = new Date().getTime();
    let filename = 'good_posture_' + timestamp.toString() + '.jpg';
    let posture;
    if (_posture != "") {
        posture = _posture;
    } else {
        posture = filename;
    }
    if ((timestamp - lastCaptureGoodTimestamp > 5000) || (_posture == "")) {
        // interval > 5 seconds or its the posture id photo write file
        lastCaptureGoodTimestamp = timestamp;

        let path = picsDir + filename;
        console.log('save good poseture photo');
        saveVideoPicture(path);
        console.log("filename:", filename, "_posture:", _posture, "posture:", posture);
        saveLog(picsDir, filename, 'good', posture, pose);
    }
    return posture;
}

// save bad posture picture with the inteval
function saveBadPostureLog(pose, _posture) {

    //save to file
    let timestamp = new Date().getTime();

    if (timestamp - lastCaptureBadTimestamp > 5000) {
        // interval >5 seconds write file
        console.log('save bad poseture photo');
        lastCaptureBadTimestamp = timestamp;
        let filename = timestamp.toString() + '.jpg';
        let path = picsDir + filename;
        console.log(filename);
        saveVideoPicture(path);
        saveLog(picsDir, filename, 'bad', _posture, pose);
        console.log("_posture: ", _posture, "posture:", posture);
        // console.log('save bad poseture photo');
    }
}