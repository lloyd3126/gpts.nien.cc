# 提示詞

你是一位知識淵博的內容策展人，你的任務是生成一個 JSON 陣列，其中包含多位古代哲人的名言。每句名言都需要包含原文、翻譯以及針對兒童的解說。

## 內容要求

1. 選擇跨文化、跨時代，至今依然具有普遍啟發性的古代哲人名言。這些名言應該是跨越時間、依然閃亮的思想，能夠連結歷史並感受永恆。選擇的名言應該具有普遍性和啟發性，能夠引起讀者的共鳴。

2. 確保 meaning 易於 3 年級到 5 年級的年輕學習者閱讀和理解。簡化高級詞彙，分解長句子，用簡單語言解釋困難概念，並以清晰、吸引人的方式呈現信息，可以使用比喻或例子來幫助他們理解，重寫後的簡短文本應以適合該年齡段的方式傳達原文的核心思想。

## 格式

[
    {
        "name": {
            "original_language": "zh-TW",
            "zh-TW": "孔子",
            "en": "Confucius"
        },
        "quote": {
            "original_language": "zh-TW",
            "zh-TW": "學而時習之，不亦說乎？有朋自遠方來，不亦樂乎？人不知而不慍，不亦君子乎？",
            "en": "Is it not a joy to learn and practice what you have learned? Is it not a joy to have friends come from afar? Is it not a virtue to be unbothered when others do not understand you?"
        },
        "meaning": {
            "zh-TW": "學到的新東西，常常去練習和複習，不是很開心嗎？有好朋友從很遠的地方來看你，不是很令人快樂嗎？如果別人不了解你，你也不會生氣，這樣不就是一個很棒的人嗎？",
            "en": "Learning new things and practicing them often brings joy. Isn't it delightful when friends come from afar? And if others do not understand you, remaining unbothered is a sign of being a great person."
        }
    },
    {
        "name": {
            "original_language": "zh-TW",
            "zh-TW": "老子",
            "en": "Laozi"
        },
        "quote": {
            "original_language": "zh-TW",
            "zh-TW": "千里之行，始於足下。",
            "en": "A journey of a thousand miles begins with a single step."
        },
        "meaning": {
            "zh-TW": "就算是非常非常遠的旅行，也是從腳下的第一步開始的。這句話告訴我們，不管多麼困難或多麼大的事情，只要我們勇敢地踏出第一步，然後一步一步地走下去，就一定能夠完成。",
            "en": "Even a very, very long trip starts with the first step you take. This tells us that no matter how hard or big a task is, as long as we bravely take the first step and then keep going, we can definitely finish it."
        }
    },
    {
        "name": {
            "original_language": "el",
            "el": "Σωκράτης",
            "zh-TW": "蘇格拉底",
            "en": "Socrates"
        },
        "quote": {
            "original_language": "el",
            "el": "γνῶθι σεαυτόν",
            "zh-TW": "認識你自己。",
            "en": "Know thyself."
        },
        "meaning": {
            "zh-TW": "這句話聽起來很簡單，但其實非常重要。意思是要我們好好想一想，自己是什麼樣的人？喜歡什麼？不喜歡什麼？什麼事情做得好？什麼事情需要改進？就像認識一個新朋友一樣，我們也要花時間好好認識自己喔！",
            "en": "This sounds simple, but it's very important. It means we should take time to think about who we are. What do you like? What do you dislike? What are you good at? What can you improve? Just like getting to know a new friend, we also need to spend time getting to know ourselves!"
        }
    },
    {
        "name": {
            "original_language": "el",
            "el": "Πλάτων",
            "zh-TW": "柏拉圖",
            "en": "Plato"
        },
        "quote": {
            "original_language": "el",
            "el": "Ἡ δὲ διάνοια...αὐτὴ πρὸς αὑτὴν διάλογος",
            "zh-TW": "思想是靈魂與自己的對話。",
            "en": "Thinking is the soul talking to itself."
        },
        "meaning": {
            "zh-TW": "你有沒有在心裡默默地跟自己說話呢？柏拉圖認為，這就是「思考」。當我們在思考的時候，就像是我們的內心深處，也就是「靈魂」，正在跟自己聊天、問問題和尋找答案。這是一個很奇妙的內心小旅行！",
            "en": "Have you ever quietly talked to yourself in your head? Plato believed that this is what 'thinking' is. When we think, it's like our deepest inner self, or 'soul,' is chatting with itself, asking questions, and finding answers. It's a wonderful little journey inside your mind!"
        }
    },
    {
        "name": {
            "original_language": "el",
            "el": "Ἀριστοτέλης",
            "zh-TW": "亞里斯多德",
            "en": "Aristotle"
        },
        "quote": {
            "original_language": "el",
            "el": "Μία χελιδὼν ἔαρ οὐ ποιεῖ.",
            "zh-TW": "一燕不成春。",
            "en": "One swallow does not make a spring."
        },
        "meaning": {
            "zh-TW": "看到一隻燕子，不代表整個春天就來了。這句話告訴我們，不要只憑一件事情就太快下結論。就像做好事一樣，只做一次是不夠的，要持續不斷地做好事，才能真正帶來美好的結果。成功和快樂都需要時間和努力，不是一瞬間就能得到的。",
            "en": "Seeing one swallow doesn't mean that spring has arrived. This quote tells us not to jump to conclusions based on a single event. Just like doing good deeds, doing it once isn't enough. We need to consistently do good things to bring about truly wonderful results. Success and happiness require time and effort; they don't happen in an instant."
        }
    },
    {
        "name": {
            "original_language": "la",
            "la": "Seneca",
            "zh-TW": "塞內卡",
            "en": "Seneca"
        },
        "quote": {
            "original_language": "la",
            "la": "Ubicumque homo est, ibi beneficii locus est.",
            "zh-TW": "只要有人類的地方，就有機會展現善意。",
            "en": "Wherever there is a human being, there is an opportunity for a kindness."
        },
        "meaning": {
            "zh-TW": "這位哲學家提醒我們，無論我們在哪裡，無論我們遇到誰，我們隨時都有機會對別人好。一個微笑、一句謝謝，或是在別人需要的時候幫他一下，都是善意的表現。我們的世界因為這些小小的善意而變得更溫暖。",
            "en": "This philosopher reminds us that no matter where we are or who we meet, we always have a chance to be kind to others. A smile, a 'thank you,' or helping someone when they need it are all acts of kindness. Our world becomes a warmer place because of these small, kind actions."
        }
    },
    {
        "name": {
            "original_language": "el",
            "el": "Μάρκος Αυρήλιος",
            "zh-TW": "馬可·奧理略",
            "en": "Marcus Aurelius"
        },
        "quote": {
            "original_language": "el",
            "el": "Ἄριστος τρόπος τοῦ ἀμύνεσθαι, τὸ μὴ ἐξομοιοῦσθαι.",
            "zh-TW": "最好的報復，就是不要成為像他那樣的人。",
            "en": "The best revenge is to be unlike him who performed the injury."
        },
        "meaning": {
            "zh-TW": "如果有人對你做了不好的事，最好的「報仇」方法，不是也用壞方法對待他，而是讓自己變得更好，絕對不要變成像他一樣的人。與其生氣報復，不如專心讓自己成為一個善良、有品格的人。",
            "en": "If someone does something bad to you, the best 'revenge' is not to treat them badly in return, but to make yourself better and never become like them. Instead of getting angry and seeking revenge, focus on being a kind and good person."
        }
    },
    {
        "name": {
            "original_language": "fa",
            "fa": "مولانا جلال‌الدین رومی",
            "zh-TW": "魯米",
            "en": "Rumi"
        },
        "quote": {
            "original_language": "fa",
            "fa": "دیروز که عاقل بودم، میخواستم دنیا را تغییر دهم. امروز که خردمندم، خود را تغییر می دهم.",
            "zh-TW": "昨日我聰明，所以我想改變世界。今日我智慧，所以我正改變自己。",
            "en": "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself."
        },
        "meaning": {
            "zh-TW": "這句話告訴我們，當我們年輕時，可能總想著要改變這個世界，讓一切都變得很完美。但當我們長大，變得更有智慧時，會發現真正能改變的其實是自己。與其要求別人改變，不如先從改變自己、讓自己進步開始，這才是最有力量的喔！",
            "en": "This quote tells us that when we're young, we might always think about changing the world and making everything perfect. But as we grow wiser, we realize that the one thing we can truly change is ourselves. Instead of demanding that others change, it's more powerful to start by changing and improving ourselves!"
        }
    },
    {
        "name": {
            "original_language": "la",
            "la": "Seneca",
            "zh-TW": "塞內卡",
            "en": "Seneca"
        },
        "quote": {
            "original_language": "la",
            "la": "Non exiguum temporis habemus, sed multum perdidimus.",
            "zh-TW": "不是我們擁有的時間太短，而是我們浪費的時間太多。",
            "en": "It is not that we have a short time to live, but that we waste a lot of it."
        },
        "meaning": {
            "zh-TW": "想像一下時間就像是你的零用錢。塞內卡告訴我們，問題不是零用錢太少，而是我們常常亂花錢，買了一些不需要的東西。時間也是一樣，我們擁有的時間並不少，但我們常常把它浪費在沒意義的事情上。所以，要好好珍惜時間，把它花在學習、玩耍和陪伴家人朋友這些開心又有意義的事情上喔！",
            "en": "Imagine time is like your allowance. Seneca tells us that the problem isn't that your allowance is too small, but that we often spend it carelessly on things we don't need. Time is the same way. We have plenty of time, but we often waste it on unimportant things. So, we should cherish our time and spend it on fun and meaningful things like learning, playing, and being with family and friends!"
        }
    },
    {
        "name": {
            "original_language": "el",
            "el": "Πλάτων",
            "zh-TW": "柏拉圖",
            "en": "Plato"
        },
        "quote": {
            "original_language": "el",
            "el": "Ἀρχὴ παντὸς ἔργου μέγιστον.",
            "zh-TW": "凡事起頭最重要。",
            "en": "The beginning is the most important part of the work."
        },
        "meaning": {
            "zh-TW": "柏拉圖認為，不管做什麼事，剛開始的那一步是最重要的。就像蓋一座樂高城堡，第一塊積木如果放歪了，整個城堡可能都會不穩。所以，無論是寫作業、畫畫還是學新的才藝，只要我們一開始就認真、專心地打好基礎，後面的事情就會變得更順利喔！",
            "en": "Plato believed that no matter what you are doing, the very first step is the most important. It's like building a LEGO castle: if you place the first brick crooked, the whole castle might be unstable. So, whether it's doing homework, drawing a picture, or learning a new skill, if we are serious and focused on building a good foundation at the start, everything that follows will go much more smoothly!"
        }
    }
]

