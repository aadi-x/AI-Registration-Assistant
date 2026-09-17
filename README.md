# AI Registration Assistant

## 📌 Task: AI-SS-001 | Free Online AI & Data Science Internship

**Company:** Data Alcott Systems  
**Domain:** Student Support & Internship Management  
**Technology:** Python, NLP, Machine Learning, Flask

## 🚀 Overview

An intelligent conversational AI chatbot that guides students through the internship registration process using Natural Language Processing (NLP) and Machine Learning techniques.

## ✨ Features

- **Intent Recognition** - TF-IDF + Naive Bayes classification for understanding user intent
- **Entity Extraction** - Regex-based extraction of names, emails, fields, experience levels
- **Dialog Management** - Stateful conversation flow with context awareness
- **Registration Workflow** - Complete end-to-end registration pipeline
- **Web Interface** - Beautiful responsive chat interface built with Flask
- **Validation** - Email format validation, name validation
- **Data Persistence** - JSON-based registration storage
- **Bonus Features** - Sentiment-aware responses, FAQ handling, conversation logging

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| Python | Core programming language |
| NLTK | Text preprocessing, tokenization, lemmatization |
| Scikit-learn | TF-IDF Vectorizer, Naive Bayes classifier |
| Flask | Web framework for chat interface |
| JSON | Data storage for registrations |
| HTML/CSS | Web interface design |

## 📋 Setup Instructions

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Installation

```bash
# Clone or download the project
cd "path/to/project"

# Install dependencies
pip install -r requirements.txt

# Download NLTK data (if not already done)
python -c "import nltk; nltk.pathsec.ALLOW_PROXIED_FETCH=True; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('punkt_tab')"

# Run the Flask web application
python app.py
```

### Access the Application

Open your browser and navigate to: **http://localhost:5001**

### CLI Mode

Run the chatbot in terminal:
```bash
python registration_assistant.py
```

## 📁 Project Structure

```
├── registration_assistant.py  # Main chatbot logic (NLP, intent, entities, dialog)
├── app.py                      # Flask web server
├── requirements.txt            # Python dependencies
├── registrations.json          # Registration data storage (auto-generated)
├── README.md                   # This file
├── project_report.md           # Detailed project report
├── templates/                  # Web page templates
│   ├── index.html             # Landing page
│   └── chat.html              # Chat interface
└── submission.csv             # Previous submission (if any)
```

## 🎯 Intents Supported

| Intent | Patterns | Description |
|---|---|---|
| greeting | hi, hello, hey | Initial greeting |
| register | register, apply, sign up | Start registration |
| name | my name is, i am | Collect name |
| email | email, @, gmail | Collect email |
| field | study, degree, engineering | Collect field of study |
| experience | experience, beginner | Collect experience level |
| confirm | confirm, yes | Confirm registration |
| help | help, support | Get help |
| thank_you | thank, thanks | Thank you response |
| bye | bye, goodbye | End conversation |

## 🧠 NLP Pipeline

1. **Preprocessing**: Lowercase → Remove punctuation → Tokenize → Lemmatize → Remove stopwords
2. **Feature Extraction**: TF-IDF with character-level n-grams (1-2 grams)
3. **Classification**: Multinomial Naive Bayes for intent classification
4. **Entity Extraction**: Regex patterns for name, email, field, experience
5. **Dialog Flow**: State machine tracking conversation progress

## 📊 Project Timeline (7 Days)

- **Day 1**: Research & Planning - Environment setup, intent design
- **Day 2**: NLP Setup & Intent Recognition - Preprocessing, classification
- **Day 3**: Entity Extraction - Regex patterns, validation
- **Day 4**: Dialog Management - State machine, conversation flow
- **Day 5**: Registration Logic - Complete workflow, JSON storage
- **Day 6**: Testing & Web Interface - Flask app, responsive design
- **Day 7**: Documentation & Submission

## 📝 License

This project is part of the Free Online AI & Data Science Internship by Data Alcott Systems.

## 📬 Contact

For any queries, contact: mail@freeinternships.in
