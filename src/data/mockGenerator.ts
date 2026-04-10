export interface GA4Event {
  event_name: string;
  user_id: string;
  session_id: string;
  timestamp: number;
  device: 'mobile' | 'desktop' | 'tablet';
  source: 'organic' | 'direct' | 'referral' | 'cpc';
  params: {
    page_location?: string;
    page_title?: string;
    page_referrer?: string;
    item_id?: string;
    item_name?: string;
    item_category?: string;
    item_list_name?: string;
    price?: number;
    value?: number;
    currency?: string;
    search_term?: string;
    percent_scrolled?: number;
    link_url?: string;
    link_text?: string;
    outbound?: boolean;
    transaction_id?: string;
    items?: Array<{
      item_id: string;
      item_name: string;
      item_category: string;
      price: number;
      quantity?: number;
    }>;
  };
}

const PAGES = [
  { path: '/', title: 'Главная' },
  { path: '/catalog', title: 'Каталог' },
  { path: '/catalog/stroymaterialy', title: 'Стройматериалы' },
  { path: '/catalog/santehnika', title: 'Сантехника' },
  { path: '/catalog/elektronika', title: 'Электроника' },
  { path: '/catalog/instrumenty', title: 'Инструменты' },
  { path: '/product/', title: 'Товар' },
  { path: '/search', title: 'Поиск' },
  { path: '/cart', title: 'Корзина' },
  { path: '/checkout', title: 'Оформление заказа' },
  { path: '/order-confirmation', title: 'Подтверждение заказа' },
  { path: '/promotions', title: 'Акции' },
  { path: '/contacts', title: 'Контакты' },
  { path: '/account', title: 'Личный кабинет' },
];

const SEARCH_TERMS = ['дрель', 'плитка', 'ванна', 'кабель', 'шуруповерт', 'краска', 'обои', 'ламинат', 'кирпич', 'цемент'];

const DEVICES = ['mobile', 'desktop', 'tablet'] as const;
const SOURCES = ['organic', 'direct', 'referral', 'cpc'] as const;

export function generateMockData(count = 2500): GA4Event[] {
  const events: GA4Event[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const userId = `user_${Math.floor(Math.random() * 1000)}`;
    const sessionId = `sess_${Math.floor(Math.random() * 5000)}`;
    const device = DEVICES[Math.random() < 0.6 ? 0 : (Math.random() < 0.9 ? 1 : 2)];
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    let timestamp = now - Math.floor(Math.random() * 7 * 24 * 3600 * 1000);

    // Initial session events
    events.push({
      event_name: 'first_visit',
      user_id: userId,
      session_id: sessionId,
      device,
      source,
      timestamp: timestamp++,
      params: {}
    });

    events.push({
      event_name: 'session_start',
      user_id: userId,
      session_id: sessionId,
      device,
      source,
      timestamp: timestamp++,
      params: {}
    });

    // Strategy-based event generation
    let currentPageIdx = 0; 
    let step = 0;
    const maxSteps = 10 + Math.floor(Math.random() * 10);

    while (step < maxSteps) {
      step++;
      const rand = Math.random();
      
      // Page View
      const page = rand < 0.3 ? PAGES[0] : (rand < 0.6 ? PAGES[1] : PAGES[Math.floor(Math.random() * PAGES.length)]);
      
      events.push({
        event_name: 'page_view',
        user_id: userId,
        session_id: sessionId,
        device,
        source,
        timestamp: timestamp++,
        params: {
          page_location: page.path,
          page_title: page.title,
          page_referrer: PAGES[currentPageIdx].path
        }
      });

      // Special actions on pages
      if (page.path === '/search') {
        const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
        events.push({
          event_name: 'search',
          user_id: userId,
          session_id: sessionId,
          device,
          source,
          timestamp: timestamp++,
          params: { search_term: term }
        });
        if (Math.random() < 0.4) {
             // Click a result
             events.push({
                event_name: 'click',
                user_id: userId,
                session_id: sessionId,
                device,
                source,
                timestamp: timestamp++,
                params: { link_text: term, link_url: '/product/search_res' }
             });
        }
      }

      if (page.path.startsWith('/catalog')) {
        events.push({
            event_name: 'view_item_list',
            user_id: userId,
            session_id: sessionId,
            device,
            source,
            timestamp: timestamp++,
            params: { item_list_name: page.title }
          });
          
          // Move to product?
          if (Math.random() < 0.3) {
            const itemId = `prod_${Math.floor(Math.random() * 1000)}`;
            const price = 500 + Math.floor(Math.random() * 50000);
            events.push({
                event_name: 'view_item',
                user_id: userId,
                session_id: sessionId,
                device,
                source,
                timestamp: timestamp++,
                params: { 
                    item_id: itemId, 
                    item_name: 'Товар ' + itemId,
                    item_category: page.title,
                    price
                }
            });

            // Add to cart?
            if (Math.random() < 0.2) {
                const val = price;
                events.push({
                    event_name: 'add_to_cart',
                    user_id: userId,
                    session_id: sessionId,
                    device,
                    source,
                    timestamp: timestamp++,
                    params: {
                        value: val,
                        currency: 'RUB',
                        items: [{ item_id: itemId, item_name: 'Товар ' + itemId, item_category: page.title, price }]
                    }
                });

                // Checkout?
                if (Math.random() < 0.6) {
                    events.push({
                        event_name: 'begin_checkout',
                        user_id: userId,
                        session_id: sessionId,
                        device,
                        source,
                        timestamp: timestamp++,
                        params: { value: val, currency: 'RUB' }
                    });

                    // Purchase?
                    if (Math.random() < 0.7) {
                        events.push({
                            event_name: 'purchase',
                            user_id: userId,
                            session_id: sessionId,
                            device,
                            source,
                            timestamp: timestamp++,
                            params: {
                                transaction_id: `T_${Math.floor(Math.random() * 100000)}`,
                                value: val,
                                currency: 'RUB',
                                items: [{ item_id: itemId, item_name: 'Товар ' + itemId, item_category: page.title, price }]
                            }
                        });
                        break; // End session after purchase usually
                    } else {
                        break; // Drop off at checkout
                    }
                }
            }
          }
      }

      // Drop off probability
      if (Math.random() < 0.2) break;
    }
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}
