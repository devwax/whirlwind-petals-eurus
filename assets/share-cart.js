if (!window.Eurus.loadedScript.has('share-cart.js')) {
  window.Eurus.loadedScript.add('share-cart.js');
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xCartShare', {
        openShareCart: false,
        cartShareUrl: "",
        shared: false,
        copySuccess: false,
        generateUrl() {
          fetch(Shopify.routes.root + 'cart.js', {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
          })
          .then(response => response.json())
          .then(response => {
            const items = response.items.slice().reverse();
            const cartParams = items.map(item => `id:${item.variant_id},q:${item.quantity}`).join('&') + '&share_cart:true';
            this.cartShareUrl = `${window.location.origin}?${cartParams}`;
          });
        },
        copyURL() {
          const cartShareInput = document.getElementById(`x-share-cart-field`);
          if (cartShareInput) {
            navigator.clipboard.writeText(cartShareInput.value).then(
              () => {
                this.copySuccess = true;
                setTimeout(() => {
                  this.copySuccess = false;
                }, 2000);
              },
              () => {
                alert('Copy fail');
              }
            );
          }
        },
        handleShareCart() {
          const queryString = window.location.search;
          if (queryString.includes("share_cart:true")) {
            const items = queryString
              .substring(1)
              .split('&')
              .reduce((listItem, param) => {
                  if (param.startsWith('id:')) {
                    const [idPart, quantityPart] = param.split(',');
                    const id = parseInt(idPart.slice(3)); 
                    const quantity = parseInt(quantityPart.slice(2));
                    listItem.push({ id, quantity });
                  }
                  return listItem;
              }, []);
            if (items.length > 0) {
              this.addCartItems(items);
            }
          }
        },
        addCartItems(items) {
          const formData = {
            'items': items,
            'sections': Alpine.store('xCartHelper').getSectionsToRender().map((s) => s.id)
          }
          
          fetch(Shopify.routes.root + "cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(formData)
          }).then(response => response.json())
            .then(response => {
              Alpine.store('xCartHelper').reRenderSections(response.sections);
              Alpine.store('xMiniCart').openCart();
              Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
              document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
              this.shared = true;
            })
            .catch(error => {
              console.error(error);
            });
        }
      });
    });
  });
}