function History_Click() {
    
    const fs = require('fs');
    const path = require("path");
    let filename = path.resolve('CountTime.csv');
    var goodTimeData = new Array;//goodtime
    var allTimeData = new Array;//alltime
    var TimeData = new Array;//CurrentTime
    let readStream = fs.createReadStream(filename, {
        encoding: 'utf8'
    });
    readStream.on("open", (data) => {
    })
    readStream.on("data", (data) => {
        console.log(data);
//var regex=/^[\\s\\p{Punct}\\p{Blank}]+$/;
    var rows = data.split("\n");
    for (var i = rows.length-1 ,k=-1; i > rows.length-9,k<7 ; i--,k++) {
        
        var cells = rows[i].split(",");
        if (i != 0) {
            for (var j = 0; j < cells.length; j++) {
                if(j==0){
                    TimeData[k]=cells[j];
                }
                if (j == 1) {
                    goodTimeData[k] = cells[j];
                }
                if (j == 3) {
                    allTimeData[k] = cells[j];
            }
            }

        }
        if(i==0)
        {
            break;
        }
        //console.log(i);
        
    }
    var oTimeDate = [];
    for(var k=0;k<7;k++)
    {
        console.log(TimeData[k]);
        var jsTime = TimeData[k];
        var dateTime = new Date(Number(jsTime));
        var oYear = dateTime.getFullYear(),
        oMonth = dateTime.getMonth()+1,
        oDay = dateTime.getDate(),
        oHour = dateTime.getHours(),
        oMin = dateTime.getMinutes(),
        oTime=oYear+"."+oMonth+"."+oDay+"-"+oHour+":"+oMin;
        // console.log(oYear);
        //console.log(oTime);
        oTimeDate[k] = oTime;

    }
    var XData=[];
    XData=oTimeDate.reverse();
    // for(var k=0;k<7;k++)
    // {
    //     console.log(XData[k]);
    // }
    
    var ratioData = new Array;//goodtime/alltime
    for(var k=0;k<7;k++)
    {
        ratioData[k]=goodTimeData[k]/allTimeData[k];
    }
    for(var k=0;k<7;k++)
    {
        console.log(goodTimeData[k]);
        console.log(allTimeData[k]);
        console.log(ratioData[k]);
    }
    var chartData=[];
    for(var k=0,f=6;k<7;k++,f--)
    {
        chartData[f]=ratioData[k];
    }
    var dom = document.getElementById("container");
    var myChart = echarts.init(dom);
    var app = {};
    option = {
        xAxis: {
            name: i18next.t("detect-times"),
            type: 'category',
            data: XData,
            axisLabel: {  
                interval:0,
                showMaxLabel: true,
                formatter:function(value)
                    {
                        debugger
                        var ret = "";//拼接加\n返回的类目项
                        for (var i = 0; i <=1; i++) {
                            var temp = "";//每次截取的字符串
                            var undernum = value.indexOf('-');
                            var start = i* undernum;//开始截取的位置
                            var end = start + undernum;//结束截取的位置
                            temp = value.substring(start,end) + "\n";
                            ret += temp; //凭借最终的字符串
                        }
                        return ret;
                    }
             }  
        },
        yAxis: {
            name: i18next.t("right-all-time"),
            type: 'value'
        },
        series: [{
            data: chartData,
            type: 'line',
            //smooth: true//折线是否平滑
        }]
    };
    $("#creditModal1").on("shown.bs.modal", function () {
        myChart.resize();

    })
    if (option && typeof option === "object") {
        myChart.setOption(option, true);
    }


    })
    
    
    readStream.on("close", (data) => {})
}