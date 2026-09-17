import os
import nltk
os.environ['NLTK_ALLOW_PROXIED_URLOPEN'] = '1'
nltk.pathsec.ALLOW_PROXIED_FETCH = True
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import re
import json
import datetime

nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('wordnet', quiet=True)
nltk.download('punkt_tab', quiet=True)

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline


class RegistrationAssistant:
    def __init__(self):
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        self.user_data = {}
        self.conversation_history = []
        self.current_state = "greeting"
        self.registration_data = {}
        self.intent_model = None
        self._load_intents()
        self._build_intent_model()

    def _load_intents(self):
        self.intents = {
            'greeting': {
                'patterns': ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
                'responses': [
                    "Hello! Welcome to the Free Online AI & Data Science Internship Registration. How can I help you?",
                    "Hi there! I'm here to assist you with your internship registration.",
                    "Hey! Great to see you. Let me help you get registered for the internship."
                ]
            },
            'register': {
                'patterns': ['register', 'apply', 'sign up', 'join', 'enroll', 'start registration'],
                'responses': [
                    "Great! I'll help you register for the internship. Please provide your full name.",
                    "Awesome! Let's get you started. What is your full name?"
                ]
            },
            'name': {
                'patterns': ['my name is', 'name', "i'm", "i am", "called", "my name"],
                'responses': [
                    "Nice to meet you, {name}! Next, I need your email address."
                ]
            },
            'email': {
                'patterns': ['email', '@', 'gmail', 'yahoo', 'outlook', 'hotmail', 'mail'],
                'responses': [
                    "Thank you! Your email {email} has been recorded. Now, please tell me your field of study."
                ]
            },
            'field': {
                'patterns': ['study', 'degree', 'computer science', 'engineering', 'it', 'technology', 'science', 'arts', 'commerce', 'business', 'management'],
                'responses': [
                    "Perfect! You're studying {field}. Now, tell me about your programming experience."
                ]
            },
            'experience': {
                'patterns': ['experience', 'know', 'learned', 'beginner', 'intermediate', 'advanced', 'expert', 'years', 'month', 'months'],
                'responses': [
                    "Great! Your experience level is {experience}. Let me confirm your registration details."
                ]
            },
            'confirm': {
                'patterns': ['confirm', 'yes', 'correct', 'right', 'that is', 'that\'s', 'proceed', 'submit', 'complete'],
                'responses': [
                    "Excellent! Your registration has been confirmed. Here are your details: {details}. Thank you for registering!"
                ]
            },
            'help': {
                'patterns': ['help', 'support', 'assist', 'guide', 'what can you do', 'how does it work'],
                'responses': [
                    "I'm here to help! You can ask me about:\n- Registration process\n- Internship details\n- Required skills\n- Application status"
                ]
            },
            'thank_you': {
                'patterns': ['thank', 'thanks', 'appreciate', 'grateful', 'cheers'],
                'responses': [
                    "You're welcome! Is there anything else I can help you with?"
                ]
            },
            'bye': {
                'patterns': ['bye', 'goodbye', 'see you', 'quit', 'exit', 'leave'],
                'responses': [
                    "Thank you for using the AI Registration Assistant. Goodbye! Have a great day!",
                    "See you later! Happy learning!"
                ]
            },
            'unknown': {
                'patterns': [],
                'responses': [
                    "I'm not sure I understood. Could you please rephrase your question?",
                    "I didn't catch that. Could you try asking differently?"
                ]
            }
        }

    def _build_intent_model(self):
        training_texts = []
        training_labels = []
        for intent, data in self.intents.items():
            for pattern in data['patterns']:
                training_texts.append(pattern)
                training_labels.append(intent)

        self.intent_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(ngram_range=(1, 2), analyzer='char_wb')),
            ('clf', MultinomialNB())
        ])
        if training_texts:
            self.intent_pipeline.fit(training_texts, training_labels)

    def preprocess_text(self, text):
        text = text.lower()
        text = re.sub(r'[^a-zA-Z\s]', '', text)
        tokens = nltk.word_tokenize(text)
        tokens = [self.lemmatizer.lemmatize(token) for token in tokens if token not in self.stop_words]
        return tokens

    def classify_intent(self, text):
        text_lower = text.lower()
        tokens = self.preprocess_text(text)
        token_str = ' '.join(tokens)

        for intent, data in self.intents.items():
            if intent == 'unknown':
                continue
            for pattern in data['patterns']:
                if re.search(r'\b' + re.escape(pattern.lower()) + r'\b', text_lower):
                    return intent
                if re.search(r'\b' + re.escape(pattern.lower()) + r'\b', token_str):
                    return intent

        if self.intent_pipeline:
            try:
                prediction = self.intent_pipeline.predict([text])[0]
                if prediction != 'unknown':
                    return prediction
            except Exception:
                pass

        return 'unknown'

    def extract_entities(self, text):
        entities = {}
        name_match = re.search(r'(?:my name is|i am|i\'m|i was|my name|called|call me)\s+([A-Za-z]+(?:\s[A-Za-z]+)*)', text, re.IGNORECASE)
        if name_match:
            name_text = name_match.group(1)
            for stop in ['and', 'with', 'but', 'or', 'then']:
                if stop in name_text.lower().split():
                    name_text = name_text.split(stop)[0].strip()
            entities['name'] = name_text.strip()

        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
        if email_match:
            entities['email'] = email_match.group()

        field_match = re.search(r'(?:studying|study|degree|field is|field|course|major)\s+(?:in\s+)?([a-zA-Z\s]+?)(?:\s*(?:with|and|and my|and i|and I|\.|,|!|\?))', text, re.IGNORECASE)
        if not field_match:
            field_match = re.search(r'(?:studying|study|degree|field is|field|course|major)\s+(?:in\s+)?([a-zA-Z\s]+?)\s*(?:\.|,|!|\?|$)', text, re.IGNORECASE)
        if field_match and len(field_match.group(1).strip()) > 2:
            entities['field'] = field_match.group(1).strip()

        experience_match = re.search(r'(?:(\d+)\s*(?:years?|months?)\s+of\s+experience)|(?:experience|experience level|level|years?\s+of|months?\s+of)\s*(\d+)', text, re.IGNORECASE)
        if experience_match:
            entities['experience'] = experience_match.group(1) or experience_match.group(2)

        if not experience_match:
            for word in ['beginner', 'intermediate', 'advanced', 'expert']:
                if re.search(r'\b' + re.escape(word) + r'\b', text.lower()):
                    entities['experience'] = word
                    break

        return entities

    def get_response(self, user_input):
        intent = self.classify_intent(user_input)
        if intent in self.intents and self.intents[intent]['responses']:
            responses = self.intents[intent]['responses']
            return responses[0], intent
        return "I'm not sure I understood. Could you please rephrase your question?", 'unknown'

    def format_response(self, response, entities):
        if '{name}' in response and 'name' in entities:
            response = response.format(name=entities['name'])
        if '{email}' in response and 'email' in entities:
            response = response.format(email=entities['email'])
        if '{field}' in response and 'field' in entities:
            response = response.format(field=entities['field'])
        if '{experience}' in response and 'experience' in entities:
            response = response.format(experience=entities['experience'])
        return response

    def update_state(self, intent, entities):
        self.conversation_history.append({
            'intent': intent,
            'entities': entities,
            'timestamp': datetime.datetime.now().isoformat()
        })
        if 'name' in entities:
            self.registration_data['name'] = entities['name']
        if 'email' in entities:
            self.registration_data['email'] = entities['email']
        if 'field' in entities:
            self.registration_data['field'] = entities['field']
        if 'experience' in entities:
            self.registration_data['experience'] = entities['experience']
        if intent in ['greeting', 'register', 'help', 'thank_you']:
            pass
        elif intent == 'name':
            self.current_state = 'awaiting_email'
        elif intent == 'email':
            self.current_state = 'awaiting_field'
        elif intent == 'field':
            self.current_state = 'awaiting_experience'
        elif intent == 'experience':
            self.current_state = 'awaiting_confirm'
        elif intent == 'confirm':
            self.current_state = 'completed'

    def validate_email(self, email):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

    def validate_name(self, name):
        return len(name.strip()) >= 2 and name.replace(' ', '').isalpha()

    def get_registration_details(self):
        details = json.dumps(self.registration_data, indent=2)
        return details

    def get_registration_summary(self):
        summary = "Registration Summary:\n"
        for key, value in self.registration_data.items():
            summary += f"  {key.capitalize()}: {value}\n"
        summary += f"  Registration Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        return summary

    def save_registration(self):
        filename = "registrations.json"
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                data = json.load(f)
        else:
            data = []
        record = {
            **self.registration_data,
            'registration_id': f"REG-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}",
            'timestamp': datetime.datetime.now().isoformat()
        }
        data.append(record)
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        return record['registration_id']

    def chat(self):
        print("=" * 60)
        print("🤖 AI Registration Assistant")
        print("   Free Online AI & Data Science Internship Task AI-SS-001")
        print("=" * 60)
        print("Type 'quit' or 'exit' to end the conversation.\n")

        while True:
            user_input = input("You: ").strip()
            if user_input.lower() in ['quit', 'exit', 'bye']:
                intent = self.classify_intent(user_input)
                response, _ = self.get_response(user_input)
                response = self.format_response(response, {})
                print(f"\nAssistant: {response}")
                break

            if not user_input:
                print("Assistant: Please say something. How can I help you?")
                continue

            entities = self.extract_entities(user_input)
            response, intent = self.get_response(user_input)
            response = self.format_response(response, entities)
            self.update_state(intent, entities)
            print(f"\nAssistant: {response}")

            if intent == 'experience' and self.registration_data:
                reg_id = self.save_registration()
                summary = self.get_registration_summary()
                print(f"\nAssistant: {summary}")
                print(f"Assistant: Your Registration ID is: {reg_id}")
                print(f"Assistant: {self.intents['thank_you']['responses'][0]}")

    def get_conversation_log(self):
        return json.dumps(self.conversation_history, indent=2)


if __name__ == "__main__":
    assistant = RegistrationAssistant()
    assistant.chat()
