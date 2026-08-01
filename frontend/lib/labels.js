// Sidebar and page titles, keyed by permission.
export const LABELS = {
  dash: 'داشبورد',
  pos: 'صندوق فروش',
  bills: 'بل‌ها و فروشات',
  top: 'تاپ‌آپ و کریدت',
  inv: 'موجودی و گدام',
  pur: 'خرید و تهیه‌کنندگان',
  cust: 'مشتریان و قرض‌ها',
  exp: 'مصارف دکان',
  rep: 'راپورها',
  price: 'قیمت‌ها و تخفیفات',
  sec: 'امنیت و بک‌اپ'
};

export const SUBTITLES = {
  dash: 'خلاصهٔ فعالیت‌های امروز سوپرمارکت',
  pos: 'فروش سریع با اسکن بارکد و چاپ بل',
  bills: 'دیدن، جستجو، چاپ و برگشت تمام بل‌ها',
  top: 'اعتبار شرکت، فرستادن تاپ‌آپ به هر نمبر و کمیشن',
  inv: 'ثبت اجناس، پیگیری موجودی و تاریخ انقضا',
  pur: 'سفارشات خرید و قرضداری‌ها',
  cust: 'ثبت قرض مشتریان و تاریخچهٔ خرید',
  exp: 'کرایه، برق، معاش و خریداری‌های دکان',
  rep: 'راپور فروش، مفاد و ضرر، اجناس پرفروش',
  price: 'قیمت‌گذاری پرچون/عمده و تخفیف‌های موسمی',
  sec: 'ثبت فعالیت‌ها و بک‌اپ معلومات'
};

// Name and address are stored in the database and edited under امنیت و بک‌اپ; these
// are only the fallbacks used before the settings load.
export const DEFAULT_STORE = {
  storeName: 'طلوع نوین',
  storeAddress: '',
  storePhone: '',
  storeLicense: ''
};

// Starting points only — both lists are free text on the product form.
export const CATEGORIES = ['مواد خوراکی', 'نوشیدنی', 'لبنیات', 'لوازم خانه',
  'شوینده و صحی', 'خوراکهٔ اطفال', 'تنقلات', 'قرطاسیه', 'متفرقه'];

export const UNITS = ['دانه', 'کیلو', 'گرام', 'قطی', 'بسته', 'بوتل', 'بوجی', 'تخته', 'کارتن', 'لیتر', 'متر'];

export const PAYMENTS = ['نقد', 'کارت', 'موبایل', 'قرض'];

// A topup is either paid for on the spot or added to the customer's قرض — there is
// no card or wallet leg to it.
export const TOPUP_PAYMENTS = ['نقد', 'قرض'];

// Amounts offered as one-tap buttons on the topup form.
export const TOPUP_AMOUNTS = [50, 100, 200, 500, 1000];

// Who paid for an expense when it came straight out of the till, as opposed to a
// staff member fronting the money and waiting to be paid back.
export const SHOP_PURSE = 'صندوق دکان';

// Free text on the form; these are the ones a supermarket reaches for most.
export const EXPENSE_CATEGORIES = [
  'خریداری برای دکان', 'کرایه دکان', 'برق و آب', 'معاش کارمندان', 'ترانسپورت',
  'ترمیم و نگهداری', 'صفایی', 'انترنت و مخابره', 'مالیه و جواز', 'پذیرایی',
  'تبلیغات', 'متفرقه'
];

// Wages already have their own cash-book tag; everything else books as 'expense'.
export const expenseTag = (category) => (category === 'معاش کارمندان' ? 'salary' : 'expense');

// Job titles offered on the account form. They are labels only — every account
// reaches every screen regardless of which one is picked.
export const JOB_TITLES = ['مدیر', 'مدیر عمومی', 'صندوق‌دار', 'فروشنده', 'گدام‌دار', 'حسابدار'];
