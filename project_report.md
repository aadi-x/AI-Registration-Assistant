# Project Report: AI Registration Assistant (Task AI-SS-001)

## 1. Introduction

This report documents the development of the **AI Registration Assistant**, a conversational AI chatbot designed to guide students through the internship registration process. The project was developed as part of the **Free Online AI & Data Science Internship** (Task AI-SS-001) by Data Alcott Systems.

## 2. Objectives

The primary objectives of this project were:

- Build a conversational AI system using NLP and Machine Learning
- Implement intent classification to understand user queries
- Develop entity extraction for capturing user information
- Create a stateful dialog management system
- Build a complete registration workflow
- Deploy the system as a web application

## 3. Methodology

### 3.1 NLP Pipeline

The chatbot uses a multi-stage NLP pipeline:

1. **Text Preprocessing**: User input is converted to lowercase, punctuation is removed, text is tokenized using NLTK's word tokenizer, tokens are lemmatized using WordNetLemmatizer, and stopwords are filtered out.

2. **Intent Classification**: A TF-IDF Vectorizer with character-level n-grams (1-2 grams) extracts features from the preprocessed text. A Multinomial Naive Bayes classifier is trained on labeled intent patterns to classify user intent into categories such as greeting, register, name, email, field, experience, etc.

3. **Entity Extraction**: Regular expressions are used to extract structured data from user messages:
   - **Name**: Pattern matching for "my name is", "I am", etc.
   - **Email**: Standard email regex pattern validation
   - **Field of Study**: Pattern matching for study/degree mentions
   - **Experience**: Extraction of beginner/intermediate/advanced levels and years

4. **Dialog Management**: A state machine tracks the conversation flow through states: greeting → awaiting_name → awaiting_email → awaiting_field → awaiting_experience → completed.

### 3.2 Machine Learning Approach

The intent classifier uses:
- **TF-IDF Vectorizer**: Converts text to numerical features using character-level n-grams
- **Multinomial Naive Bayes**: A probabilistic classifier suitable for text classification
- **Training Data**: Intent patterns defined in the intents dictionary

### 3.3 Web Framework

Flask was chosen for the web interface due to its simplicity and lightweight nature. The application exposes REST API endpoints for chat interaction and includes a responsive HTML/CSS interface.

## 4. Implementation Details

### 4.1 Registration Workflow

1. User initiates with "Register" or "Apply"
2. Bot asks for full name → User provides name
3. Bot asks for email → User provides email
4. Bot asks for field of study → User provides field
5. Bot asks for programming experience → User provides experience
6. Bot confirms all details and generates registration ID
7. Registration data is saved to `registrations.json`

### 4.2 Data Storage

Registration data is stored in a JSON file (`registrations.json`). Each registration includes:
- Name, Email, Field, Experience
- Auto-generated Registration ID (timestamp-based)
- Timestamp of registration

### 4.3 Error Handling

- Invalid email format validation
- Name validation (minimum 2 characters, alphabetic)
- Unknown intent handling with fallback responses
- Empty input handling

## 5. Results and Demo

The chatbot successfully:
- Classifies user intents with high accuracy
- Extracts entities correctly from natural language
- Maintains conversation state throughout the registration flow
- Provides appropriate responses for all registered intents
- Generates valid registration records

## 6. Bonus Features Implemented

- **Conversation Logging**: Full conversation history stored in JSON format
- **Registration Summary**: Auto-generated summary with registration ID
- **Web Interface**: Beautiful, responsive chat UI with typing indicators
- **Reset Functionality**: Ability to reset conversation state

## 7. Conclusion

The AI Registration Assistant demonstrates the practical application of NLP and Machine Learning in building conversational AI systems. The project successfully implements intent recognition, entity extraction, dialog management, and a complete registration workflow using Python and open-source libraries.

## 8. Future Enhancements

- Integration with BERT or Transformer models for improved intent classification
- Multi-language support
- Sentiment analysis for user satisfaction measurement
- Admin dashboard for viewing all registrations
- Database integration (SQLite/PostgreSQL)
- WebSocket support for real-time communication

---

**Project Title**: AI Registration Assistant  
**Task ID**: AI-SS-001  
**Internship Program**: Free Online AI & Data Science Internship  
**Developer**: Data Alcott Systems Intern  
**Date**: September 2026
