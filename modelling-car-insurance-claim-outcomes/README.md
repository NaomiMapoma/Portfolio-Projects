# 🚘 &nbsp; Modelling Car Insurance Claim Outcomes

## 📚 &nbsp; Overview

This project builds a predictive model for an insurance company to identify which customers are likely to make a claim during their policy period. The goal is to find the <b>single most predictive feature</b> that delivers the highest model accuracy, given the company's limited machine learning infrastructure. The analysis uses logistic regression on a cleaned customer dataset to determine the optimal simple model for potential deployment.

## 🎯 &nbsp; Project Objectives

- Load and explore customer data
- Handle missing values
- Train individual logistic regression models using <b>each feature separately</b>
- Evaluate model performance <b>accuracy</b>, calculated using a <b>confusion matrix</b>
- Identify the <b>single best-performing feature</b> for predicting car insurance claims

## 🔢 &nbsp; Dataset

The data comes from a single CSV file:

| file | description |
|---|---|
|`car_insurance.csv`| customer profiles & claim history

Dataset colums:

| column | definition |
|---|---|
| `id` | unique client identifier |
| `age` | client's age: 0 (16-25), 1 (26-39), 2 (40-64), 3 (65+) |
| `gender` | client's gender: 0 (female), 1 (male) |
| `driving_experience` | years the client has been driving: 0 (0-9), 1 (10-19), 2 (20-29), 3 (30+) |
| `education` | client's level of education: 0 (no education), 1 (high school), 2 (university) |
| `income` | client's income level: 0 (poverty), 1 (working class), 2 (middle class), 3 (upper class) |
| `credit_score` | client's credit score (between zero and one) |
| `vehicle_ownership` | client's vehicle ownership status: 0 (does not own their vehicle - finance), 1 (owns their vehicle) |
| `vehicle_year` | year of vehicle registration: 0 (before 2015), 1 (2015 or later) |
| `married` | client's marital status: 0 (not married), 1 (married) |
| `children` | client's number of children |
| `postal_code` | client's postal code |
| `annual_mileage` | number of miles driven by the client each year |
| `vehicle_type` | type of car: 0 (sudan), 1 (sports car) |
| `speeding_violations` | total number of speeding violations received by the client |
| `duis` | number of times the client has been caught driving under the influence of alcohol |
| `past_accidents` | total number of previous accidents the client has been involved in |
| `outcome` | whether the client made a claim on their car insurance: 0 (no claim), 1 (made a claim) |

## 🛠️ &nbsp; Tools

- <b>Python</b>
- <b>pandas</b> for data loading & exploratory data analysis
- <b>numpy</b> for numerical operations
- <b>statsmodel</b> for logistic regression modelling
- <b>seaborn & matplotlib</b> for data visualisation
- <b>Jupyter Notebook</b> for documentation & storytelling

## 💡 &nbsp; Key Findings

- <b>Best predictive feature:</b> `driving_experience`
- <b>Highest model accuracy:</b> 77.71%
- Among all individual features, <b>driving experience</b> was the strongest predictor of whether a customer would make a claim on their car insurance
- Missing values in `credit score` and `annual_mileage` were inputed using the <b>mean</b> as the missing values data were <b>normally distributed</b>

[`View the notebook here in Jupyter`](https://github.com/NaomiMapoma/Portfolio-Projects/blob/main/modelling-car-insurance-claim-outcomes/python/modelling_car_insurance_claim_outcomes.ipynb)
