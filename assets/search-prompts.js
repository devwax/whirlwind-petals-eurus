if (!window.Eurus.loadedScript.has('search-prompts.js')) {
    window.Eurus.loadedScript.add('search-prompts.js');
  
    requestAnimationFrame(() => {
      document.addEventListener("alpine:init", () => {
        Alpine.data('xSearchPrompts', (
          element,
          searchPrompts,
          enableOnMobile
        ) => ({
          index: 0,
          indexMax: 2,
          diffIndex: [],
          diffStr: [],

          splitString(str1, str2) {
            let diffStr = "";
            const minLength = Math.min(str1.length, str2.length);
            let diffIndex = -1;

            for (let i = 0; i < minLength; i++) {
              if (str1[i] !== str2[i]) {
                diffIndex = i;
                break;
              }
            }

            if (diffIndex === -1) {
              if (str1 === str2) {
                // Identical strings
                diffIndex = str2.length - 1;
                diffStr = str2[diffIndex];
              } else {
                // Substring
                diffIndex = minLength;
                diffStr = str2.slice(diffIndex, str2.length);
              }
            } else {
              diffStr = str2.slice(diffIndex, str2.length);
            }

            return {diffIndex, diffStr};
          },

          async updatePlaceholder(el) {
            const sleep = ms => new Promise(r => setTimeout(r, ms));

            await sleep(500);

            if (this.diffIndex[this.index] < el.placeholder.length - 1) {
              for (let i = el.placeholder.length - 1; i > this.diffIndex[this.index]; i--) {
                el.placeholder = el.placeholder.slice(0, i - 1); 
                await sleep(80); // 750cpm typing speed
              }
            } else if (this.diffIndex[this.index] === el.placeholder.length - 1) {
              el.placeholder = el.placeholder.slice(0, this.diffIndex[this.index]);
              await sleep(80);
            }

            await sleep(800); // 800ms delay before start adding chars
            for (let i = 0; i < this.diffStr[this.index].length; i++) {
              el.placeholder += this.diffStr[this.index][i];
              await sleep(100); // 600cpm typing speed
            }
            
            if (this.index === this.indexMax) {
              this.index = 0;
            } else {
              this.index++;
            }
            
            setTimeout(() => this.updatePlaceholder(el), 500);
          },
          
          init() {
            if (window.matchMedia("(max-width: 768px)").matches && !enableOnMobile) {
              return;
            }
            const nonEmptyPrompts = searchPrompts.filter(prompt => prompt !== '');
            let pairs = [
              [0, 1],
              [1, 2],
              [2, 0]
            ];

            if (nonEmptyPrompts.length === 0) {
                return;
            } else if (nonEmptyPrompts.length === 1) {
              element.placeholder = nonEmptyPrompts[0];
              return;
            } else if (nonEmptyPrompts.length === 2) {
              pairs = [
                [0, 1],
                [1, 0]
              ];
              this.indexMax = 1;
            }

            element.placeholder = nonEmptyPrompts[0];
        
            pairs.forEach(([i, j], index) => {
              let result = this.splitString(nonEmptyPrompts[i], nonEmptyPrompts[j]);
              this.diffIndex[index] = result.diffIndex;
              this.diffStr[index] = result.diffStr;
            });

            this.updatePlaceholder(element);
          }
        }))
      });
    });
  } 