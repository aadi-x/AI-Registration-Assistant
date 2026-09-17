import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

# Load data
train = pd.read_csv('C:\\Users\\adity\\Downloads\\train (1).csv')
test = pd.read_csv('C:\\Users\\adity\\Downloads\\test (1).csv')
sample = pd.read_csv('C:\\Users\\adity\\Downloads\\sample_submission.csv')

# Select features
features = ['GrLivArea', 'BedroomAbvGr', 'FullBath', 'HalfBath', 'GarageCars', 'YearBuilt']

# Handle missing values - fill with median
train[features] = train[features].fillna(train[features].median())
test[features] = test[features].fillna(test[features].median())

# Encode categorical features if any
for f in features:
    if train[f].dtype == 'object':
        train[f] = train[f].astype('category').cat.codes
        test[f] = test[f].astype('category').cat.codes

# Split data
X_train, X_val, y_train, y_val = train_test_split(
    train[features], train['SalePrice'], test_size=0.2, random_state=42)

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)

# Train model
model = LinearRegression()
model.fit(X_train_scaled, y_train)

# Evaluate
y_pred = model.predict(X_val_scaled)
print('R² score:', r2_score(y_val, y_pred))
print('MAE:', mean_absolute_error(y_val, y_pred))
print('RMSE:', np.sqrt(mean_squared_error(y_val, y_pred)))

# Print coefficients
coefs = pd.DataFrame({'Feature': features, 'Coefficient': model.coef_})
print('\nCoefficients:')
print(coefs)
print('\nIntercept:', model.intercept_)

# Make predictions on test set
for f in features:
    if train[f].dtype == 'object':
        test[f] = test[f].astype('category').cat.codes

test_scaled = scaler.transform(test[features])
test_pred = model.predict(test_scaled)

# Create submission file
submission = pd.DataFrame({
    'Id': test['Id'],
    'SalePrice': test_pred
})
output_path = "C:\\Users\\adity\\OneDrive\\Documents\\Default Project\\submission.csv"
submission.to_csv(output_path, index=False)
print('\nSubmission file saved to:', output_path)
print('Sample submission:')
print(submission.head())
print('File exists:', __import__('os').path.exists(output_path))