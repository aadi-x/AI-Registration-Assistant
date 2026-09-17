import os
import json
import datetime

from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

from registration_assistant import RegistrationAssistant
assistant = RegistrationAssistant()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/chat')
def chat():
    return render_template('chat.html')


@app.route('/api/chat', methods=['POST'])
def api_chat():
    data = request.get_json(force=True)
    user_input = data.get('message', '')

    if not user_input:
        return jsonify({'response': 'Please provide a message.', 'intent': 'unknown'})

    entities = assistant.extract_entities(user_input)
    response, intent = assistant.get_response(user_input)
    response = assistant.format_response(response, entities)
    assistant.update_state(intent, entities)

    if intent == 'experience' and assistant.registration_data:
        reg_id = assistant.save_registration()
        response += f"\n\nYour Registration ID is: {reg_id}"

    conversation_log = assistant.get_conversation_log()

    return jsonify({
        'response': response,
        'intent': intent,
        'entities': entities,
        'registration_data': assistant.registration_data,
        'conversation_log': conversation_log
    })


@app.route('/api/reset', methods=['POST'])
def reset():
    global assistant
    assistant = RegistrationAssistant()
    return jsonify({'status': 'reset', 'message': 'Conversation reset successfully.'})


@app.route('/api/registration', methods=['GET'])
def get_registration():
    return jsonify({
        'registration_data': assistant.registration_data,
        'summary': assistant.get_registration_summary()
    })


@app.route('/api/intents', methods=['GET'])
def get_intents():
    intents_list = []
    for intent, data in assistant.intents.items():
        intents_list.append({
            'intent': intent,
            'patterns': data['patterns'],
            'responses': data['responses']
        })
    return jsonify({'intents': intents_list})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
