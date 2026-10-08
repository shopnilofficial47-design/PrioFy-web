# 🏆 Sports Stream Live

GitHub + Vercel দিয়ে ডিপ্লয় করা স্পোর্টস লাইভ স্ট্রিমিং সাইট।

## ফিচার
- **লাইভ API** থেকে ডাটা নেয় (স্ট্যাটিক JSON আর লাগে না)
- আজকের ম্যাচের লিস্ট (ক্রিকেট, ফুটবল, NBA, NHL ইত্যাদি)
- ক্যাটাগরি ফিল্টার
- লাইভ ব্যাজ
- স্ট্রিম লিংক মডাল
- স্পোর্টস চ্যানেল লিস্ট
- ডার্ক থিম + মোবাইল ফ্রেন্ডলি

## API Sources
- Events → `https://ratulxadia-playz-cats-event.hf.space/api/events`
- Streams → `https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app/.json`

## লোকাল রান

শুধু ফোল্ডার ওপেন করে `index.html` ব্রাউজারে খুললেই চলবে।  
অথবা:

```bash
npx serve .
```

## GitHub এ আপলোড

1. নতুন রিপোজিটরি তৈরি করো (public বা private)
2. এই ফোল্ডারের সব ফাইল আপলোড করো:

```bash
git init
git add .
git commit -m "Initial Sports Stream site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sports-stream.git
git push -u origin main
```

## Vercel এ ডিপ্লয়

1. [vercel.com](https://vercel.com) এ গিয়ে GitHub দিয়ে লগইন করো
2. **Add New Project** → তোমার `sports-stream` রিপো সিলেক্ট করো
3. Framework Preset: **Other** (বা Leave blank)
4. Root Directory: `./` (ডিফল্ট)
5. **Deploy** চাপো

কয়েক সেকেন্ডে লাইভ লিংক পাবে!

### অটো আপডেট
GitHub এ `git push` করলে Vercel অটোমেটিক নতুন ভার্সন ডিপ্লয় করবে।

## ফোল্ডার স্ট্রাকচার

```
sports-stream/
├── index.html
├── style.css
├── app.js
├── data/
│   ├── events.json
│   └── streams.json
├── README.md
└── vercel.json
```

## নোট
- `data/events.json` → ম্যাচের তালিকা
- `data/streams.json` → স্ট্রিম লিংক ও চ্যানেল
- কিছু স্ট্রিম লিংক ভিপিএন বা স্পেশাল হেডার চাইতে পারে
