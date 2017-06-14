import {
  Component, NgZone, ViewChild, ElementRef, Input, Output, EventEmitter, OnChanges,
  SimpleChange, AfterViewInit
} from "@angular/core";

import * as d3 from "d3";

@Component({
  selector: "codable-timeline",
  templateUrl: "codable-timeline.component.html",
  styleUrls: ["./codable-timeline.component.scss"]
})

export class CodableTimelineComponent implements  OnChanges, AfterViewInit
{
  private static readonly MS_PER_DAY = 24 * 3600 * 1000;
  
  @ViewChild("timelinecontainer") el : ElementRef;
  @Input() width : number;
  @Input() height : number;
  
  private visEl : any;
  public x = d3.scaleTime();
  private xAxis = d3.axisBottom(this.x).ticks(7);
  private xCurrentStart : Date;
  private xCurrentEnd : Date;
  private isBrowser = true;
  @Input() margin : {top : number, right : number, bottom : number, left : number};
  
  public loaded = false;
  
  @Output() onScaleUpdate = new EventEmitter<any>();
  @Output() onVisibleTimesChange = new EventEmitter<Date[]>();
  
  // private mc : any;
  private indicatorTimes : Date[] = [];
  
  private lastCalled = 0;
  private lastStart;
  private lastEnd;
  
  private isPanning = false;
  // private panningEnd = -1;
  
  private lastVisibleTimes = [];
  
  constructor(private zone: NgZone)
  {
  
  }
  
  ngAfterViewInit()
  {
    this.setupAxis();
  }
  
  @Input()
  set xStart(xStart: Date)
  {
    if (!xStart)
    {
      return;
    }
    if (!this.xCurrentStart)
    {
      this.xCurrentStart = xStart;
      return;
    }
    
    if (Math.abs(this.xCurrentStart.getTime() - xStart.getTime()) > 5)
    {
      this.zoomIfCalledTwice(xStart, null);
    }
  }
  
  @Input()
  set xEnd(xEnd: Date)
  {
    if (!xEnd)
    {
      return;
    }
    
    if (!this.xCurrentEnd)
    {
      this.xCurrentEnd = xEnd;
      return;
    }
    
    if (Math.abs(this.xCurrentEnd.getTime() - xEnd.getTime()) > 5)
    {
      this.zoomIfCalledTwice(null, xEnd);
    }
  }
  
  zoomIfCalledTwice(start: Date, end: Date)
  {
    if (Date.now() - this.lastCalled === 0)
    {
      this.lastCalled = 0;
      let startDate = start || this.lastStart;
      let endDate = end || this.lastEnd;
      this.zoom(this.xCurrentStart, startDate, this.xCurrentEnd, endDate);
    }
    else
    {
      this.lastStart = start;
      this.lastEnd = end;
      this.lastCalled = Date.now();
    }
  }
  
  ngOnChanges(changes: {[propKey: string]: SimpleChange})
  {
    if (this.height)
    {
      this.loadVis();
    }
  }
  
  setupAxis()
  {
    let formatMillisecond = d3.timeFormat(".%L"),
        formatSecond = d3.timeFormat(":%S"),
        formatMinute = d3.timeFormat("%I:%M"),
        formatHour = d3.timeFormat("%I %p"),
        formatDay = d3.timeFormat("%d"),
        formatWeek = d3.timeFormat("%d"),
        formatMonth = d3.timeFormat("%b"),
        formatYear = d3.timeFormat("%Y");
    
    function multiFormat(date) {
      return (d3.timeSecond(date) < date ? formatMillisecond
          : d3.timeMinute(date) < date ? formatSecond
              : d3.timeHour(date) < date ? formatMinute
                  : d3.timeDay(date) < date ? formatHour
                      : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
                          : d3.timeYear(date) < date ? formatMonth
                              : formatYear)(date);
    }
    
    this.xAxis.tickFormat(multiFormat);
  }
  
  pxForRelativeTime(relativeTime: Date): number
  {
    return this.x(new Date(this.xCurrentStart.getTime() + relativeTime.getTime())) - this.x(this.xCurrentEnd);
  }
  
  setVisEl()
  {
    this.visEl = d3.select(this.el.nativeElement);
  }
  
  loadVis()
  {
    if (this.loaded)
    {
      return;
    }
    
    this.setVisEl();
    /*
    let containers : HTMLCollectionOf<Element> = document.getElementsByClassName('photo-timeline-container');
    let currentWrapper = containers[containers.length-1];
    //console.log(currentWrapper);
    //console.log(document.getElementsByClassName('photo-timeline-container'), wrapper.clientWidth, wrapper.clientHeight);
    //this.setVisSize(currentWrapper.clientWidth, currentWrapper.clientHeight );*/
    this.setVisSize();
    
    this.initVis();
    
    window.setTimeout(() =>
    {
      this.setupGestures();
      /*this.setupPanning();
       this.setupPinching();*/
      this.loaded = true;
    }, 1500);
  }
  
  initVis()
  {
    this.x.domain([this.xCurrentStart, this.xCurrentEnd]);
    this.onScaleUpdate.emit(this.x);
    
    this.updateBarWidth();
    
    let axis = this.visEl.select("g.axis");
    
    axis.append("g")
        .attr("class", "axis axis--x");
    
    this.callAxis();
    this.setAxisPositions();
  }
  
  callAxis(): void
  {
    let axis = this.visEl.select("g.axis");
    
    axis.select(".axis.axis--x")
        .call(this.xAxis);
  }
  
  pan()
  {
  
  }
  
  setupPinching()
  {
    let element = this.el.nativeElement;
    
    let startPinchX: number[];
    let startDomain: Date[] = [this.xCurrentStart, this.xCurrentEnd];
    let startPinchDates: Date[];
    let zeroX: number;
    
    let pinching = false;
    
    
    element.addEventListener("touchstart", (ev) =>
    {
      if (ev.touches && ev.touches.length === 2)
      {
        pinching = true;
        zeroX = this.x(this.xCurrentStart);
        startPinchX = [ev.touches[0].clientX, ev.touches[1].clientX];
        startPinchDates = [this.x.invert(startPinchX[0] - zeroX), this.x.invert(startPinchX[1] - zeroX)];
        // console.log(startPinchDates);
        startDomain = [this.xCurrentStart, this.xCurrentEnd];
      }
    }, false);
    element.addEventListener("touchmove", (ev) =>
    {
      if (ev.touches && ev.touches.length === 2)
      {
        let positions = [ev.touches[0].clientX, ev.touches[1].clientX];
        
        this.pinchFromTo(startPinchX, positions, startDomain, startPinchDates);
        // dataUpdater();
      }
    }, false);
    
    // var element = document.getElementById('timelineContainer');
    element.addEventListener("touchend", () =>
    {
      if (pinching)
      {
        pinching = false;
        // this.updateData();
        // this.setNewActivePhotos();
      }
      
    }, false);
  }
  
  pinchFromTo(from: number[], to: number[], startDomain: Date[], fromDates: Date[]): void
  {
    let distFrom = Math.abs(from[0] - from[1]);
    let distTo = Math.abs(to[0] - to[1]);
    
    let scale = distFrom / distTo;
    // console.log(scale, distFrom, distTo);
    let prevSpanInMs = startDomain[1].getTime() - startDomain[0].getTime();
    let newSpanInMs = prevSpanInMs * scale;
    
    let newStart = startDomain[0]; // todo this needs to incorporate the position of the pinch
    let newEnd = new Date(newStart.getTime() + newSpanInMs);
    
    this.setXdomain(newStart, newEnd);
    
    let newToDate = this.x(fromDates[0]); // is supposed to be to[0]
    let offsetInPx = newToDate - to[0];
    let zeroX = this.x(this.xCurrentStart);
    let offsetInMs = this.x.invert(zeroX - offsetInPx).getTime() - this.xCurrentStart.getTime();
    
    let newStart2 = new Date(newStart.getTime() - offsetInMs);
    let newEnd2 = new Date(newEnd.getTime() - offsetInMs);
    this.setXdomain(newStart2, newEnd2);
    
    // this.updateData();
    // console.log(newToDate - to[0], newToDate, to[0]);
  }
  
  setupGestures()
  {
    
    // this.mc = new Hammer(element);
    //
    // //this.mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 0 }));
    // this.mc.add(new Hammer.Pinch({ threshold: 0 }));
    this.setupTouchZoom();
  }
  
  setupTouchZoom()
  {
    let element = this.el.nativeElement;
    let zooming = false;
    let panning = false;
    let x = 0;
    let startX = 0;
    let mouseDownTime = 0;
    let mouseUpTime = 0;
    let zoomingOut = false;
    
    let recursiveZoom = () =>
    {
      let scale = zoomingOut ? 1.1 : 0.9;
      let newDomain = this.getNewDomain(x, scale);
      
      this.zoom(this.xCurrentStart, newDomain[0], this.xCurrentEnd, newDomain[1], 40).then(() =>
      {
        if (zooming)
        {
          recursiveZoom();
        }
        else
        {
        
        }
      });
    };
    let zoomTimeout;
    
    let zoomStart = (event) =>
    {
      if (!zooming && (event.clientX || event.touches.length === 1))
      {
        let isRightClick = (event.clientX) && (("which" in event && event.which === 3) || ("button" in event && event.button === 2));
        if (isRightClick)
        {
          return;
        }
        
        startX = event.clientX || event.touches[0].clientX;
        x = startX;
        mouseDownTime = Date.now();
        zoomingOut = mouseUpTime && mouseDownTime - mouseUpTime < 200;
        panning = true;
        // recursiveZoom();
        
        // start Panning
        
        zoomTimeout = window.setTimeout(() =>
        {
          if (Math.abs(x - startX) < 3 && mouseUpTime < mouseDownTime)
          {
            panning = false;
            zooming = true;
            recursiveZoom();
          }
        }, 300);
      }
    };
    
    let zeroX = this.x(this.xCurrentStart);
    
    let zoomMove = (event) =>
    {
      if (event.clientX || event.touches.length === 1)
      {
        let isRightClick = (event.clientX) && (("which" in event && event.which === 3) || ("button" in event && event.button === 2));
        if (isRightClick)
        {
          return;
        }
        
        this.zone.run(() =>
        {
          
          let newX = event.clientX || event.touches[0].clientX;
          
          if (!zooming && panning)
          {
            // pan
            let delta = newX - x;
            let movedByMs = this.x.invert(zeroX - delta).getTime() - this.xCurrentStart.getTime();
            // let totalMovedByMs = this.x.invert(zeroX+totalDelta).getTime() - this.xDomain[0].getTime();
            // console.log(ev.deltaX, delta, totalDelta, movedByMs / TimelinePage.MS_PER_DAY, totalMovedByMs / TimelinePage.MS_PER_DAY);
            let newStart = new Date(this.xCurrentStart.getTime() + movedByMs);
            let newEnd = new Date(this.xCurrentEnd.getTime() + movedByMs);
            
            this.setXdomain(newStart, newEnd);
          }
          
          x = newX;
        });
      }
    };
    
    let zoomEnd = (event) =>
    {
      // for some reason, on mobile, event.touches is often of length 0.
      if (event.clientX || (event.touches && event.touches.length < 2))
      {
        mouseUpTime = Date.now();
        
        panning = false;
        zooming = false;
        zoomingOut = false;
        window.clearTimeout(zoomTimeout);
        
        this.zone.run(() =>
        {
          this.updateVisibleTime();
        });
      }
    };
    
    if (this.isBrowser)
    {
      element.addEventListener("mousedown", zoomStart);
      element.addEventListener("mousemove", zoomMove);
      element.addEventListener("mouseup", zoomEnd);
    }
    else
    {
      element.addEventListener("touchstart", zoomStart);
      element.addEventListener("touchmove", zoomMove);
      element.addEventListener("touchend", zoomEnd);
    }
    element.addEventListener("mouseout", zoomEnd);
    
    /*element.addEventListener('contextmenu', (event) =>
     {
     //zoomEnd(event);
     event.preventDefault();
     event.stopPropagation();
     return false;
     });*/
    
  }
  
  setupPanning()
  {
    // console.log("hello"+this.y(0));
    // var element = this.el.nativeElement;
    
    // let totalDelta = 0;
    // let zeroX = this.x(this.xCurrentStart);
    
    // let lastEvtWasFinal = true;
    this.isPanning = false;
    
    /*let touchEnd = () => {
      lastEvtWasFinal = true;
      
      if (this.isPanning)
      {
        // this.setNewActivePhotos();
        this.panningEnd = Date.now();
      }
      
      this.isPanning = false;
    };*/
    /*
     element.addEventListener('touchend', touchEnd);
     element.addEventListener('mouseup', touchEnd);
     
     this.mc.on("panleft panright", (ev) =>
     {
     this.zone.run(() =>
     {
     this.isPanning = true;
     if(lastEvtWasFinal)
     {
     totalDelta = 0;
     lastEvtWasFinal = false;
     //console.log('is first', ev);
     }
     
     let inputDelta = ev.deltaX;
     let delta = inputDelta - totalDelta;
     totalDelta += delta;
     let movedByMs = this.x.invert(zeroX-delta).getTime() - this.xDomain[0].getTime();
     //let totalMovedByMs = this.x.invert(zeroX+totalDelta).getTime() - this.xDomain[0].getTime();
     //console.log(ev.deltaX, delta, totalDelta, movedByMs / TimelinePage.MS_PER_DAY, totalMovedByMs / TimelinePage.MS_PER_DAY);
     
     let newStart = new Date(this.xDomain[0].getTime() + movedByMs);
     let newEnd = new Date(this.xDomain[1].getTime() + movedByMs);
     
     this.setXdomain([newStart, newEnd]);
     //this.setNewActivePhotos();
     //this.zoom(this.xDomain[0], newStart, this.xDomain[1], newEnd);
     //this.xDomain=[newStart,newEnd];
     });
     });*/
  }
  
  getNewDomain(x, percentageChange)
  {
    let startingXPosition = this.x(this.xCurrentStart);
    let xStart = this.x.invert(x - startingXPosition);
    let newtotalDays;
    let newStart;
    let newEnd;
    
    let timeDiff = this.xCurrentEnd.getTime() - this.xCurrentStart.getTime();
    newtotalDays = timeDiff * percentageChange;
    let selectPercentage = (xStart.getTime() - this.xCurrentStart.getTime()) / timeDiff;
    
    newStart = new Date(xStart.getTime() - selectPercentage * newtotalDays);
    newEnd = new Date(newStart.getTime() + newtotalDays);
    
    return [newStart, newEnd];
  }
  
  zoomInOut(x, change)
  {
    let percentageChange = (change > 0) ? 0.5 : 2;
    let newDomain = this.getNewDomain(x, percentageChange);
    let newStart = newDomain[0];
    let newEnd = newDomain[1];
    
    this.zoom(this.xCurrentStart, newStart, this.xCurrentEnd, newEnd).then(() =>
    {
      this.zone.run(() =>
      {
        // this.updateBins();
        // this.setNewActivePhotos();
      });
    });
  }
  
  onDoubleClick(ev)
  {
    /*this.zone.run(() =>
     {
     this.zoomInOut(ev.clientX, 1);
     });*/
  }
  
  onWheel(ev)
  {
    this.zone.run(() =>
    {
      let change = ev.wheelDelta / Math.abs(ev.wheelDelta);
      // console.log(change)
      
      if (!isNaN(change))
      {
        this.zoomInOut(ev.clientX, change);
      }
    });
  }
  
  setAxisPositions()
  {
    let axis = this.visEl.select("g.axis");
    axis.select(".axis--x").attr("transform", "translate(0," + (this.height - this.margin.bottom) + ")");
    axis.select(".axis--y").attr("transform", "translate(" + this.margin.left + ",0)");
  }
  
  setVisSize()
  {
    this.x.range([this.margin.left, this.width - this.margin.right]);
    
    this.updateBarWidth();
    
    // console.log(this.xDomain)
    this.setAxisPositions();
  }
  
  timeDiff(date1: Date, date2: Date): number
  {
    return Math.abs(date1.getTime() - date2.getTime());
  }
  
  /*zoomOut()
   {
   let newDomain = this.getMaxDomain();
   this.zoom(this.xStart, newDomain[0], this.xEnd, newDomain[1]).then(() =>
   {
   this.zone.run(() =>
   {
   // this.updateBins();
   // this.setNewActivePhotos();
   });
   });
   }*/
  
  zoom(currentStart, newStart, currentEnd, newEnd, duration = 800): Promise<void>
  {
    return new Promise<void>((resolve, reject) =>
    {
      let startInterpolator = d3.interpolate(currentStart, newStart);
      let endInterpolator = d3.interpolate(currentEnd, newEnd);
      
      d3.transition("zoom").duration(duration)
          .ease(t =>
          {
            let inBetweenStart = new Date(startInterpolator(t));
            let inBetweenEnd = new Date(endInterpolator(t));
            this.zone.run(() =>
            {
              this.setXdomain(inBetweenStart, inBetweenEnd);
            });
            return t;
          })
          .on("end", () => {
            this.zone.run(() =>
            {
              this.setXdomain(newStart, newEnd);
              resolve();
            });
          });
    });
  }
  
  setXdomain(xStart: Date, xEnd: Date)
  {
    this.x.domain([xStart, xEnd]);
    this.xCurrentStart = xStart;
    this.xCurrentEnd = xEnd;
    this.callAxis();
    this.updateBarWidth();
    this.updateMonthInformer();
    
    this.onScaleUpdate.emit(this.x);
    this.updateVisibleTime();
  }
  
  
  
  updateMonthInformer()
  {
    let oneMonthInMs = CodableTimelineComponent.MS_PER_DAY * 30;
    let isLittleTime = this.xCurrentEnd.getTime() - this.xCurrentStart.getTime() < 3 * oneMonthInMs;
    let end = this.xCurrentEnd.getTime() + oneMonthInMs;
    this.indicatorTimes = [];
    
    if (isLittleTime)
    {
      for (let time = this.xCurrentStart.getTime(); time < end; time += oneMonthInMs)
      {
        this.indicatorTimes.push(this.getBeginningOfMonth(new Date(time)));
      }
    }
  }
  
  
  updateVisibleTime()
  {
    if (this.lastVisibleTimes[0] !== this.xCurrentStart || this.lastVisibleTimes[1] !== this.xCurrentEnd)
    {
      this.lastVisibleTimes = [this.xCurrentStart, this.xCurrentEnd];
      this.onVisibleTimesChange.emit(this.lastVisibleTimes);
    }
  }
  
  getBeginningOfMonth(date: Date): Date
  {
    return new Date(date.getFullYear(), date.getMonth());
  }
  
  updateBarWidth()
  {
  
  }
  
  isSameDate(date1, date2)
  {
    return date1.toDateString() === date2.toDateString();
  }
}
