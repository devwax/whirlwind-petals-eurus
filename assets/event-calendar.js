if (!window.Eurus.loadedScript.has('event-calendar.js')) {
  window.Eurus.loadedScript.add('event-calendar.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xEventCalendar', (event) => ({
        open: false,
        eventDetails: {},
        addToCal(options) {
          let link = "";
          let timeEnd = ""
          this.eventDetails = event;

          if(!event) {
            this.eventDetails = JSON.parse(JSON.stringify(Alpine.store("xEventCalendarDetail").eventDetail))
          }

          let timeStart = this.handleTime(this.eventDetails.start_year, this.eventDetails.month, this.eventDetails.day, this.eventDetails.start_hour, this.eventDetails.start_minute, options);

          if (this.eventDetails.show_end_date) {
            timeEnd = this.handleTime(this.eventDetails.end_year, this.eventDetails.end_month, this.eventDetails.end_day, this.eventDetails.end_hour, this.eventDetails.end_minute, options);
          } 
          else if (this.eventDetails.show_end_time) {
            timeEnd = this.handleTime(this.eventDetails.start_year, this.eventDetails.month, this.eventDetails.day, this.eventDetails.end_hour, this.eventDetails.end_minute, options);
          }
          else {
            timeEnd = timeStart;
          }

          switch (options) {
            case 'apple':
              this.createDownloadICSFile(0, timeStart, timeEnd, this.eventDetails.title, this.eventDetails.details, this.eventDetails.location, "apple");
              break;
            case 'google':
              link = "http://www.google.com/calendar/event?action=TEMPLATE&trp=false" + "&text=" + encodeURIComponent(this.eventDetails.title) + "&dates=" + timeStart + "/" +  timeEnd + "&location=" + encodeURIComponent(this.eventDetails.location) + "&details=" + encodeURIComponent(this.eventDetails.details);
              window.open(link);
              break;
            case 'outlook':
              link = "https://outlook.live.com/calendar/action/compose?rru=addevent" + "&startdt=" + timeStart + "&enddt=" + timeEnd + "&subject=" + encodeURIComponent(this.eventDetails.title) + "&location=" + encodeURIComponent(this.eventDetails.location) + "&body=" + encodeURIComponent(this.eventDetails.details);
              window.open(link)
              break;
            case 'yahoo':
              link = "http://calendar.yahoo.com/?v=60" + "&st=" + timeStart + "&et=" +  timeEnd + "&title=" + encodeURIComponent(this.eventDetails.title);
              window.open(link)
              break;
            case 'ical': 
              this.createDownloadICSFile(0, timeStart, timeEnd, this.eventDetails.title, this.eventDetails.details, this.eventDetails.location, "ical");
              break;
            default:
              console.log(`Sorry, error`);
          }
        },
        handleTime(year,month,day,hour,minute,options) {
          let date = new Date();

          if (options == 'google' || options == 'yahoo') {
            date = new Date(Date.UTC(year, this.getMonthNumber(month), parseInt(day), parseInt(hour), parseInt(minute)));
            date.setTime(date.getTime() + (-1 * parseFloat(this.eventDetails.timezone) * 60 - date.getTimezoneOffset()) * 60 * 1000)
            return date.toISOString().split("Z")[0].replace(".000", "").replace(/[^A-Z0-9]/ig, "");
          } else {
            date = new Date(year, this.getMonthNumber(month), parseInt(day), parseInt(hour), parseInt(minute));
            date.setTime(date.getTime() + (-1 * parseFloat(this.eventDetails.timezone) * 60 - date.getTimezoneOffset()) * 60 * 1000)
            if ( options == 'apple' ) {
              return date.toISOString().split("Z")[0].replace(".000", "").replace(/[^A-Z0-9]/ig, "");
            } else {
              return date.toISOString();
            }
          }
        },
        getMonthNumber(month) {
          return new Date(`${month} 1, 2022`).getMonth();
        },
        createDownloadICSFile(timezone, timeStart, timeEnd, title, description, location, type) {
          let icsBody = "BEGIN:VCALENDAR\n" +
          "VERSION:2.0\n" +
          "PRODID:Calendar\n" +
          "CALSCALE:GREGORIAN\n" +
          "METHOD:PUBLISH\n" +
          "BEGIN:VTIMEZONE\n" +
          "TZID:" + timezone + "\n" +
          "END:VTIMEZONE\n" +
          "BEGIN:VEVENT\n" +
          "SUMMARY:" + title + "\n" +
          "UID:@Default\n" +
          "SEQUENCE:0\n" +
          "STATUS:CONFIRMED\n" +
          "TRANSP:TRANSPARENT\n" +
          "DTSTART;TZID=" + timezone + ":" + timeStart + "\n" +
          "DTEND;TZID=" + timezone + ":" + timeEnd + "\n" +
          "LOCATION:" + location + "\n" +
          "DESCRIPTION:" + description + "\n" +
          "END:VEVENT\n" +
          "END:VCALENDAR\n";

          this.download(title + ".ics", icsBody, type);
        },
        download(filename, fileBody, type) {
          var element = document.createElement("a");

          if (type == "ical") {
            element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(fileBody));
          } else if (type == "apple") {
            var file = new Blob([fileBody], { type: "text/calendar;charset=utf-8"})
            element.href = window.URL.createObjectURL(file)
          }

          element.setAttribute("download", filename);
          element.style.display = "none";
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
        }
      }));

      Alpine.store('xEventCalendarDetail', {
        show: false,
        eventDetail: {title: "Default"},
        handleEventSelect() {
          var _this = this;
          const eventDetail = JSON.parse(JSON.stringify(this.eventDetail));
  
          document.addEventListener('shopify:section:select', function(event) {
            if (event.target.classList.contains('section-event-calendar') == false) {
              if (window.Alpine) {
                _this.close();
              } else {
                document.addEventListener('alpine:initialized', () => {
                  _this.close();
                });
              }
            }
          })
          
          if(eventDetail && eventDetail.blockID && eventDetail.sectionID) {
            this.eventDetail = xParseJSON(document.getElementById('x-data-event-' + eventDetail.blockID).getAttribute('x-event-data'));
            let element = document.getElementById('EventDescription-' + this.eventDetail.sectionID);
            element.innerHTML = this.eventDetail.description;
            element.innerHTML = element.textContent;
          }
        },
        load(el, blockID) {
          this.eventDetail = xParseJSON(el.closest('#x-data-event-' + blockID).getAttribute('x-event-data'));
          let element = document.getElementById('EventDescription-' + this.eventDetail.sectionID);
          this.sectionID = this.eventDetail.sectionID;
          element.innerHTML = this.eventDetail.description;
          element.innerHTML = element.textContent;
          this.showEventCalendarDetail();
        },
        showEventCalendarDetail() {
          this.show = true;
          Alpine.store('xPopup').open = true;
        },
        close() {
          this.show = false;
          Alpine.store('xPopup').close();
        }
      });
    });
  });
}