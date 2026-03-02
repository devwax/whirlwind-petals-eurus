if (!window.Eurus.loadedScript.has('article.js')) {
    window.Eurus.loadedScript.add('article.js');
  
    requestAnimationFrame(() => {
      document.addEventListener('alpine:init', () => {
        Alpine.data('xArticle', () => ({
          init() {
            if (document.querySelector('.menu-article')) {
              const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                    if (document.querySelector('.menu-article .active')) {
                      document.querySelector('.menu-article .active').classList.remove("active");
                    }
                    document.querySelectorAll('.item-menu-article')[entry.target.dataset.index].classList.add("active");
                  }
                });
              }, {rootMargin: '0px 0px -60% 0px'});
              if (this.$refs.content.querySelectorAll('h2, h3, h4').length > 1) {
                this.$refs.content.querySelectorAll('h2, h3, h4').forEach((heading, index) => {
                  heading.dataset.index = index;
                  observer.observe(heading);
                });
              } else {
                document.querySelector('.menu-article').remove();
              }
            }
          },
          loadData(list_style) {
            const load = document.querySelector('.load-curr');
            const loadBar = document.querySelector('.load-bar');
            const element = this.$refs.content;
            document.addEventListener('scroll', () => {
              const elementTop = element.offsetTop;
              const elementHeight = element.offsetHeight;
              const windowHeight = window.innerHeight;
              const scrollPosition = window.scrollY + windowHeight;

              let scrollPercent;

              if (scrollPosition < elementTop) {
                scrollPercent = 0;
                loadBar.classList.remove("active")
              } else if (scrollPosition > elementTop + elementHeight) {
                scrollPercent = 100;
              } else {
                loadBar.classList.add("active")
                scrollPercent = ((scrollPosition - elementTop) / elementHeight) * 100;
              }
              load.style.width = `${scrollPercent.toFixed(2)}%`
            })
            const heading2 = this.$refs.content.querySelectorAll('h2, h3, h4');
            if (heading2.length > 1) {
              let htmlContent = "";
              heading2.forEach((item, index) => {
                if (item.tagName === 'H2') {
                  htmlContent += "<li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li>";
                }
                if (item.tagName === 'H3') {
                  if (heading2[index-1] && heading2[index-1].tagName === 'H2') {
                    if (index !== heading2.length-1 && heading2[index+1].tagName !== 'H2') {
                      htmlContent += list_style === 'Unordered' ? "<ul class='toc:m-0 toc:pl-5'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li>" 
                      : "<ul class='toc:m-0 toc:pl-4'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li>"
                    } else {
                      htmlContent += list_style === 'Unordered' ? "<ul class='toc:m-0 toc:pl-5'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul>"
                      : "<ul class='toc:m-0 toc:pl-4'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul>"
                    }
                  } else {
                    if (index !== heading2.length-1 && heading2[index+1].tagName !== 'H2') {
                      htmlContent += "<li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li>"
                    } else {
                      htmlContent += "<li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul>"
                    }
                  }      
                }
                if (item.tagName === 'H4') {
                  if (heading2[index-1] && heading2[index-1].tagName !== 'H4') {
                    if (index !== heading2.length-1 && heading2[index+1].tagName === 'H4') {
                      htmlContent += list_style === 'Unordered' ? "<ul class='toc:m-0 toc:pl-5'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li>"
                      : "<ul class='toc:m-0 toc:pl-6'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li>"
                    } else if (index !== heading2.length-1 && heading2[index+1].tagName === 'H3') {
                      htmlContent += list_style === 'Unordered' ? "<ul class='toc:m-0 toc:pl-5'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul>"
                      : "<ul class='toc:m-0 toc:pl-6'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul>"
                    } else {
                      htmlContent += list_style === 'Unordered' ? "<ul class='toc:m-0 toc:pl-5'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul></ul>"
                      : "<ul class='toc:m-0 toc:pl-6'><li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul></ul>"
                    }
                  } else {
                    if (index !== heading2.length-1 && heading2[index+1].tagName === 'H4') {
                      htmlContent += "<li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li>"
                    } else if (index !== heading2.length-1 && heading2[index+1].tagName === 'H3') {
                      htmlContent += "<li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul>"
                    } else {
                      htmlContent += "<li class='toc:m-0 item-menu-article w-full cursor-pointer pb-2' @click='scrollTop($el," + index + ")' >" + item.textContent + "</li></ul></ul>"
                    }
                  }
                }
              })
              document.querySelector('.list-menu-article').innerHTML += htmlContent;
            }
          },
          scrollTop(el,index) {
            if (this.$refs.content.querySelectorAll('h2, h3, h4').length > index) {
              if (document.querySelector('.menu-article .active')) {
                document.querySelector('.menu-article .active').classList.remove("active");
              }
              el.classList.add("active");
              this.$refs.content.querySelectorAll('h2, h3, h4')[index].scrollIntoView({ behavior: "smooth" });
            }
          }
        }));

        Alpine.store('xSideBar', {
          setPositionSideBar() {
            let sideBar = document.getElementById('side-bar');
            let sideBarContent = document.getElementById('side-bar-template');
            if (sideBarContent) {
              sideBar.innerHTML = sideBarContent.innerHTML;
              let tableInfomation = document.querySelector('.menu-article');
              if (tableInfomation && sideBar.children[0].dataset.position == tableInfomation.dataset.position) {
                if (sideBar.children[0].dataset.sticky && !tableInfomation.dataset.sticky) {
                  sideBar.classList.add("lg:sticky");
                  tableInfomation.appendChild(sideBar);
                } else {
                  tableInfomation.children[0].appendChild(sideBar);
                }
                sideBar.classList.add("lg:pt-5")
                sideBar.classList.remove("lg:w-1/3")
              } else {
                sideBar.classList.add("lg:w-1/3")
                if (sideBar.children[0].dataset.position == "right") {
                  sideBar.classList.add("order-3");
                } else {
                  sideBar.classList.add("order-1");
                }
              }
              sideBar.classList.remove("hidden");
            } else {
              sideBar.classList.add("hidden");
            }
          }
        })
      })
    });
  }