import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Concept from "../models/Concept.js";

const concepts = [
    {
        conceptId: "linear_regression",
        title: "Linear Regression",
        description: "Model the relationship between a dependent variable and one or more independent variables using a linear function.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["supervised", "regression", "statistics"],
        pipeline: {
            explanation: "Linear regression fits a straight line y = mx + b to your data by minimizing the sum of squared residuals. The slope m measures how much y changes per unit change in x, and the intercept b is the predicted value when x = 0. The ordinary least squares (OLS) method finds the optimal parameters analytically.",
            demonstration: "Visualize a scatter plot of study hours vs exam score. Drag data points to see how the best-fit line adjusts in real time. Observe how outliers affect slope and R² score.",
            practiceQuestions: [
                { question: "What does the slope represent in a simple linear regression?", options: ["The y-intercept", "Rate of change of y per unit x", "The R² value", "The error term"], correctAnswer: 1, explanation: "The slope measures how much the dependent variable changes for each unit increase in the independent variable.", difficulty: 2 },
                { question: "Which metric measures goodness-of-fit in regression?", options: ["Accuracy", "R² (coefficient of determination)", "F1-score", "Cross-entropy"], correctAnswer: 1, explanation: "R² indicates the proportion of variance in the dependent variable explained by the model.", difficulty: 2 },
                { question: "What assumption does OLS require about residuals?", options: ["They must be positive", "They must be normally distributed with constant variance", "They must equal zero", "They must increase with x"], correctAnswer: 1, explanation: "OLS assumes residuals are i.i.d. normal with zero mean and constant variance (homoscedasticity).", difficulty: 3 },
            ],
            applicationTask: "Train a linear regression model on a housing price dataset. Use square footage as the feature and price as the target. Calculate R², MSE, and interpret the coefficients.",
            evaluationCriteria: "Model achieves R² > 0.6 and the student can explain what the slope and intercept mean for this domain.",
        },
    },
    {
        conceptId: "logistic_regression",
        title: "Logistic Regression",
        description: "A classification algorithm that models the probability of a binary outcome using the sigmoid function.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["linear_regression"],
        tags: ["supervised", "classification", "probability"],
        pipeline: {
            explanation: "Logistic regression maps a linear combination of features through the sigmoid function σ(z) = 1/(1+e^(-z)) to produce probabilities between 0 and 1. A threshold (usually 0.5) converts probabilities to class labels. It is trained by maximizing the log-likelihood using gradient descent.",
            demonstration: "Visualize the sigmoid curve. Adjust weights to see how the decision boundary shifts. Toggle between linear and logistic outputs to understand the probability mapping.",
            practiceQuestions: [
                { question: "What is the range of the sigmoid function?", options: ["(-∞, ∞)", "[-1, 1]", "(0, 1)", "[0, ∞)"], correctAnswer: 2, explanation: "The sigmoid function always outputs values strictly between 0 and 1.", difficulty: 2 },
                { question: "Which loss function is used for logistic regression?", options: ["MSE", "Binary cross-entropy", "Hinge loss", "Huber loss"], correctAnswer: 1, explanation: "Binary cross-entropy (log loss) penalizes confident wrong predictions heavily.", difficulty: 3 },
                { question: "What happens when the decision boundary threshold is lowered from 0.5 to 0.3?", options: ["Fewer positives predicted", "More positives predicted (higher recall)", "No change", "Model retrains"], correctAnswer: 1, explanation: "A lower threshold classifies more instances as positive, increasing recall but potentially decreasing precision.", difficulty: 3 },
            ],
            applicationTask: "Build a spam/not-spam classifier using logistic regression. Compute accuracy, precision, recall, and plot the ROC curve.",
            evaluationCriteria: "ROC-AUC > 0.75 and the student can explain the precision-recall tradeoff.",
        },
    },
    {
        conceptId: "gradient_descent",
        title: "Gradient Descent",
        description: "An iterative optimization algorithm that minimizes a function by moving in the direction of steepest descent.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["linear_regression"],
        tags: ["optimization", "calculus", "training"],
        pipeline: {
            explanation: "Gradient descent updates parameters by subtracting the gradient of the loss function scaled by a learning rate: θ = θ - α·∇J(θ). A small learning rate converges slowly, while a large one may overshoot. Variants include batch, stochastic (SGD), and mini-batch gradient descent.",
            demonstration: "Interactive 3D surface plot of a loss function. Adjust learning rate and watch the optimization path. Compare batch vs. SGD trajectories.",
            practiceQuestions: [
                { question: "What happens if the learning rate is too large?", options: ["Slow convergence", "The algorithm may overshoot and diverge", "Faster convergence always", "No effect"], correctAnswer: 1, explanation: "An excessively large learning rate causes the parameter updates to overshoot the minimum.", difficulty: 2 },
                { question: "What is the key difference between SGD and batch gradient descent?", options: ["SGD uses all data points", "SGD uses one data point per update", "Batch uses one point", "No difference"], correctAnswer: 1, explanation: "SGD approximates the gradient using a single randomly chosen sample, making it faster but noisier.", difficulty: 3 },
                { question: "When should you stop gradient descent?", options: ["After 100 iterations", "When the gradient is approximately zero", "When loss increases", "After one epoch"], correctAnswer: 1, explanation: "Convergence is reached when the gradient magnitude is near zero (or loss change is below a threshold).", difficulty: 2 },
            ],
            applicationTask: "Implement gradient descent from scratch to fit a linear model. Plot the loss curve over iterations for three different learning rates (0.001, 0.01, 0.1).",
            evaluationCriteria: "Correctly implements the update rule and can explain how learning rate affects convergence speed and stability.",
        },
    },
    {
        conceptId: "decision_trees",
        title: "Decision Trees",
        description: "A non-parametric model that splits data using feature-based rules to make predictions.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["supervised", "classification", "regression", "interpretable"],
        pipeline: {
            explanation: "Decision trees recursively partition the feature space by choosing the split that maximizes information gain (or minimizes Gini impurity). Each internal node tests a feature, each branch represents a test outcome, and each leaf holds a prediction. Trees are interpretable but prone to overfitting without pruning.",
            demonstration: "Build a decision tree step-by-step: select features, see how splits partition the data, and watch the tree grow. Toggle between Gini and entropy criteria.",
            practiceQuestions: [
                { question: "What metric does a decision tree use to choose the best split?", options: ["R² score", "Information gain or Gini impurity", "Cross-entropy loss", "Mean absolute error"], correctAnswer: 1, explanation: "Decision trees select splits that maximize information gain (or equivalently minimize impurity).", difficulty: 2 },
                { question: "What is overfitting in the context of decision trees?", options: ["Underfitting the training data", "Memorizing training data, poor generalization", "Using too few features", "Having high bias"], correctAnswer: 1, explanation: "Deep trees memorize noise in training data and fail to generalize to unseen data.", difficulty: 2 },
                { question: "How does pruning help a decision tree?", options: ["Makes it deeper", "Removes branches that add little predictive power", "Adds more features", "Changes the split criterion"], correctAnswer: 1, explanation: "Pruning reduces tree complexity by removing branches with minimal improvement, improving generalization.", difficulty: 3 },
            ],
            applicationTask: "Train a decision tree on the Iris dataset. Visualize the tree structure and compare accuracy with and without max_depth constraints.",
            evaluationCriteria: "Demonstrates understanding of overfitting by comparing pruned vs unpruned trees.",
        },
    },
    {
        conceptId: "neural_networks_basics",
        title: "Neural Networks Fundamentals",
        description: "Understand the building blocks of artificial neural networks: neurons, layers, activations, and forward propagation.",
        category: "Deep Learning",
        difficulty_level: 3,
        prerequisites: ["gradient_descent"],
        tags: ["deep-learning", "neural-network", "perceptron"],
        pipeline: {
            explanation: "A neural network is composed of layers of interconnected neurons. Each neuron computes a weighted sum of its inputs, adds a bias, and passes the result through an activation function (ReLU, sigmoid, tanh). Forward propagation passes data layer-by-layer from input to output. Backpropagation computes gradients for training.",
            demonstration: "Interactive network builder: add/remove layers, change neuron count and activation functions, watch data flow through the network as colored signals.",
            practiceQuestions: [
                { question: "What does the activation function do?", options: ["Normalizes weights", "Introduces non-linearity into the model", "Updates the learning rate", "Computes the loss"], correctAnswer: 1, explanation: "Without activation functions, a multi-layer network would collapse into a single linear transformation.", difficulty: 2 },
                { question: "What is the purpose of the bias term?", options: ["It speeds up training", "It allows the activation function to shift left or right", "It prevents overfitting", "It reduces dimensions"], correctAnswer: 1, explanation: "Bias allows the neuron to activate even when all inputs are zero, adding flexibility.", difficulty: 3 },
                { question: "How many parameters does a layer with 10 inputs and 5 neurons have?", options: ["50", "55", "15", "10"], correctAnswer: 1, explanation: "10×5 = 50 weights plus 5 biases = 55 parameters total.", difficulty: 3 },
            ],
            applicationTask: "Build a simple 2-layer neural network to classify XOR inputs. Verify it cannot be solved with a single-layer perceptron.",
            evaluationCriteria: "Successfully classifies XOR and explains why a single perceptron fails (linear inseparability).",
        },
    },
    {
        conceptId: "backpropagation",
        title: "Backpropagation",
        description: "The algorithm used to compute gradients for training neural networks via the chain rule of calculus.",
        category: "Deep Learning",
        difficulty_level: 4,
        prerequisites: ["neural_networks_basics", "gradient_descent"],
        tags: ["deep-learning", "training", "calculus"],
        pipeline: {
            explanation: "Backpropagation computes the gradient of the loss w.r.t. each weight by applying the chain rule backward through the network. Starting from the output loss, it propagates error signals layer-by-layer, computing ∂L/∂w for each weight. Combined with gradient descent, this allows training deep networks.",
            demonstration: "Step through backpropagation on a 2-layer network: see the forward pass values, loss computation, then gradient flow backward through each layer with numerical values displayed.",
            practiceQuestions: [
                { question: "What mathematical rule does backpropagation rely on?", options: ["Product rule", "Chain rule", "Quotient rule", "L'Hôpital's rule"], correctAnswer: 1, explanation: "The chain rule decomposes derivatives of composed functions, enabling gradient computation through layers.", difficulty: 3 },
                { question: "What is the vanishing gradient problem?", options: ["Gradients become too large", "Gradients become extremely small in deep networks", "Learning rate is zero", "Network has no bias"], correctAnswer: 1, explanation: "With sigmoid/tanh activations in deep networks, gradients shrink exponentially as they propagate back.", difficulty: 4 },
                { question: "Which activation function helps mitigate vanishing gradients?", options: ["Sigmoid", "Tanh", "ReLU", "Softmax"], correctAnswer: 2, explanation: "ReLU has a constant gradient of 1 for positive inputs, preventing gradient shrinkage.", difficulty: 3 },
            ],
            applicationTask: "Manually compute the backpropagation pass for a 2-neuron network on a given example. Verify your gradients using numerical differentiation.",
            evaluationCriteria: "Correctly applies chain rule and gradient values match numerical approximation within ε = 0.001.",
        },
    },
    {
        conceptId: "cnn_basics",
        title: "Convolutional Neural Networks",
        description: "Specialized neural networks for processing grid-structured data like images using convolutional filters.",
        category: "Deep Learning",
        difficulty_level: 4,
        prerequisites: ["neural_networks_basics", "backpropagation"],
        tags: ["deep-learning", "computer-vision", "convolution"],
        pipeline: {
            explanation: "CNNs apply learnable filters (kernels) that slide across images to detect local patterns like edges, textures, and shapes. Pooling layers reduce spatial dimensions. The architecture typically stacks Conv→ReLU→Pool layers followed by fully connected layers for classification.",
            demonstration: "Visualize convolution: apply different 3×3 kernels (edge detection, blur, sharpen) to an image. See pooling reduce dimensions and feature maps highlight detected patterns.",
            practiceQuestions: [
                { question: "What does a convolutional filter detect?", options: ["Global patterns", "Local spatial patterns like edges and textures", "Color histograms", "Sound frequencies"], correctAnswer: 1, explanation: "Convolutional filters learn to detect local patterns through their small receptive field.", difficulty: 3 },
                { question: "What is the purpose of max pooling?", options: ["Increases resolution", "Reduces spatial dimensions and provides translation invariance", "Adds more parameters", "Normalizes pixels"], correctAnswer: 1, explanation: "Max pooling down-samples feature maps, reducing computation and providing shift invariance.", difficulty: 3 },
                { question: "If an input image is 32×32 with 3 channels and you apply 16 filters of size 5×5 with no padding, what is the output size?", options: ["28×28×16", "32×32×16", "28×28×3", "5×5×16"], correctAnswer: 0, explanation: "Output size = 32 - 5 + 1 = 28 per dimension, with 16 feature maps from the 16 filters.", difficulty: 4 },
            ],
            applicationTask: "Build a CNN to classify handwritten digits (MNIST). Experiment with different numbers of convolutional layers and filter sizes.",
            evaluationCriteria: "Achieves > 95% accuracy on MNIST test set and can explain the role of each layer.",
        },
    },
    {
        conceptId: "clustering_kmeans",
        title: "K-Means Clustering",
        description: "An unsupervised algorithm that partitions data into K clusters by minimizing within-cluster variance.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["unsupervised", "clustering", "centroid"],
        pipeline: {
            explanation: "K-Means initializes K centroids randomly, then alternates between: (1) assigning each point to the nearest centroid, and (2) updating centroids as the mean of assigned points. It converges when assignments stabilize. The elbow method helps choose K by plotting inertia vs K.",
            demonstration: "Watch K-Means iterate: see centroids move and cluster colors update step-by-step. Adjust K and observe how clusters change.",
            practiceQuestions: [
                { question: "What does K represent in K-Means?", options: ["Number of features", "Number of clusters", "Number of iterations", "Number of data points"], correctAnswer: 1, explanation: "K is a hyperparameter specifying the desired number of clusters.", difficulty: 1 },
                { question: "How does K-Means assign a point to a cluster?", options: ["Random assignment", "Nearest centroid by Euclidean distance", "Based on class label", "Alphabetical order"], correctAnswer: 1, explanation: "Each point is assigned to the cluster whose centroid is closest (typically Euclidean distance).", difficulty: 2 },
                { question: "What is the elbow method?", options: ["A regularization technique", "Plotting inertia vs K to find the optimal number of clusters", "A dimensionality reduction method", "A type of activation function"], correctAnswer: 1, explanation: "The elbow method identifies the K where adding more clusters yields diminishing returns in inertia reduction.", difficulty: 3 },
            ],
            applicationTask: "Apply K-Means to customer data. Use the elbow method to determine the optimal K and profile each customer segment.",
            evaluationCriteria: "Correctly identifies the elbow point and provides meaningful segment descriptions.",
        },
    },
    {
        conceptId: "nlp_tokenization",
        title: "NLP Tokenization",
        description: "The process of breaking text into meaningful units (tokens) for natural language processing tasks.",
        category: "Natural Language Processing",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["nlp", "text-processing", "preprocessing"],
        pipeline: {
            explanation: "Tokenization splits raw text into tokens: words, subwords, or characters. Word-level tokenization uses whitespace/punctuation splits. Subword methods (BPE, WordPiece) handle unknown words by breaking them into known subunits. Tokenization choices affect vocabulary size and model performance.",
            demonstration: "Enter any text and see it tokenized using different methods: whitespace, regex, BPE, and character-level. Compare vocabulary sizes and OOV handling.",
            practiceQuestions: [
                { question: "Why is subword tokenization preferred over word-level?", options: ["It is faster", "It handles unknown words by decomposing them", "It produces fewer tokens", "It is simpler to implement"], correctAnswer: 1, explanation: "Subword tokenization can represent rare/unseen words as combinations of known subword units.", difficulty: 3 },
                { question: "What problem does tokenization solve?", options: ["Image classification", "Converting text to numerical representations for models", "Database optimization", "Audio processing"], correctAnswer: 1, explanation: "Models need numerical input; tokenization is the first step to convert text into processable tokens.", difficulty: 2 },
                { question: "What is a token?", options: ["A word only", "A meaningful unit of text — word, subword, or character", "A sentence", "A document"], correctAnswer: 1, explanation: "Tokens can be words, subwords, or characters depending on the tokenization strategy.", difficulty: 1 },
            ],
            applicationTask: "Implement a basic tokenizer supporting whitespace and BPE modes. Tokenize a sample text and compare the vocabulary sizes.",
            evaluationCriteria: "Both tokenizers produce correct output and the student can discuss trade-offs.",
        },
    },
    {
        conceptId: "sentiment_analysis",
        title: "Sentiment Analysis",
        description: "Classify text as expressing positive, negative, or neutral sentiment using NLP techniques.",
        category: "Natural Language Processing",
        difficulty_level: 3,
        prerequisites: ["nlp_tokenization", "logistic_regression"],
        tags: ["nlp", "classification", "sentiment"],
        pipeline: {
            explanation: "Sentiment analysis pipelines involve: (1) text preprocessing (tokenization, stopword removal, lowercasing), (2) feature extraction (bag-of-words, TF-IDF, or embeddings), and (3) classification (Naive Bayes, logistic regression, or deep learning). Modern approaches use transformer encoders for richer contextual representations.",
            demonstration: "Enter movie reviews and see real-time sentiment scores. Toggle between bag-of-words and TF-IDF features to see how they affect predictions.",
            practiceQuestions: [
                { question: "What is TF-IDF?", options: ["A neural network architecture", "A weighting scheme that considers term frequency and document rarity", "A tokenization method", "A clustering algorithm"], correctAnswer: 1, explanation: "TF-IDF weights terms by how frequent they are in a document (TF) vs how rare across all documents (IDF).", difficulty: 3 },
                { question: "Which baseline model is commonly used for sentiment analysis?", options: ["K-Means", "Naive Bayes", "Linear Regression", "PCA"], correctAnswer: 1, explanation: "Naive Bayes is a strong baseline for text classification due to its effectiveness with bag-of-words features.", difficulty: 2 },
                { question: "Why is negation handling important in sentiment analysis?", options: ["It improves tokenization speed", "'not good' should be negative, not averaged as neutral", "It reduces vocabulary size", "It is not important"], correctAnswer: 1, explanation: "Negation flips sentiment polarity — without handling it, 'not good' might incorrectly seem positive from 'good'.", difficulty: 3 },
            ],
            applicationTask: "Build a sentiment classifier for product reviews using TF-IDF features and logistic regression. Evaluate with precision, recall, and F1.",
            evaluationCriteria: "F1 > 0.7 on a test split, with a confusion matrix showing balanced performance.",
        },
    },
    {
        conceptId: "data_preprocessing",
        title: "Data Preprocessing",
        description: "Transform raw data into a clean, structured format suitable for analysis and model training.",
        category: "Data Analytics",
        difficulty_level: 1,
        prerequisites: [],
        tags: ["data-science", "cleaning", "feature-engineering"],
        pipeline: {
            explanation: "Data preprocessing includes: handling missing values (imputation, deletion), encoding categorical variables (one-hot, label encoding), scaling numerical features (standardization, min-max), and detecting outliers. Good preprocessing is often the difference between a mediocre and an excellent model.",
            demonstration: "Load a messy dataset and interactively apply preprocessing steps: fill missing values, encode categories, and scale features. See summary statistics update after each step.",
            practiceQuestions: [
                { question: "Why is feature scaling important?", options: ["It makes data smaller", "Algorithms like SVM and kNN are sensitive to feature magnitudes", "It is purely cosmetic", "It removes outliers"], correctAnswer: 1, explanation: "Distance-based algorithms perform poorly when features have vastly different scales.", difficulty: 2 },
                { question: "What is one-hot encoding?", options: ["Converting floats to integers", "Creating binary columns for each category value", "Hashing categories", "Removing categorical features"], correctAnswer: 1, explanation: "One-hot encoding represents each category as a binary vector, avoiding ordinal assumptions.", difficulty: 2 },
                { question: "How should you handle missing values?", options: ["Always delete rows", "Choose between imputation (mean/median/mode) and deletion based on context", "Always fill with 0", "Ignore them"], correctAnswer: 1, explanation: "The strategy depends on the proportion of missing data and whether missingness is random or systematic.", difficulty: 2 },
            ],
            applicationTask: "Clean a real-world dataset: handle missing values, encode categoricals, scale numerics, and detect/handle outliers. Document each decision.",
            evaluationCriteria: "Dataset has no missing values, all features are model-ready, and preprocessing decisions are justified.",
        },
    },
    {
        conceptId: "eda",
        title: "Exploratory Data Analysis",
        description: "Use statistical summaries and visualizations to understand patterns, trends, and anomalies in data.",
        category: "Data Analytics",
        difficulty_level: 1,
        prerequisites: [],
        tags: ["data-science", "visualization", "statistics"],
        pipeline: {
            explanation: "EDA involves computing descriptive statistics (mean, median, std, quartiles), examining distributions (histograms, box plots), exploring relationships (scatter plots, correlation matrices), and identifying anomalies. It helps form hypotheses and guides subsequent modeling decisions.",
            demonstration: "Upload a CSV and get automatic EDA: summary statistics, distribution plots, correlation heatmap, and missing value report.",
            practiceQuestions: [
                { question: "What does a box plot show?", options: ["Only the mean", "Median, quartiles, and potential outliers", "Just the range", "Frequency distribution"], correctAnswer: 1, explanation: "Box plots display the median, IQR (Q1-Q3), and whiskers indicating the data spread, with outliers shown as points.", difficulty: 1 },
                { question: "What does a correlation coefficient of -0.9 indicate?", options: ["Weak positive relationship", "Strong negative linear relationship", "No relationship", "Quadratic relationship"], correctAnswer: 1, explanation: "A coefficient near -1 indicates a strong negative linear correlation between two variables.", difficulty: 2 },
                { question: "Why perform EDA before modeling?", options: ["It is required by law", "To understand data quality, distributions, and relationships that inform model choice", "To train the model", "It is optional"], correctAnswer: 1, explanation: "EDA reveals data issues, patterns, and relationships that should inform preprocessing and model selection.", difficulty: 1 },
            ],
            applicationTask: "Perform a complete EDA on a sales dataset. Produce at least 5 visualizations: distribution of revenue, correlation heatmap, time series trend, category comparison, and outlier detection.",
            evaluationCriteria: "Visualizations are properly labeled and each has an accompanying insight/interpretation.",
        },
    },
    {
        conceptId: "random_forests",
        title: "Random Forests",
        description: "An ensemble method that combines multiple decision trees trained on random subsets of data and features.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["decision_trees"],
        tags: ["ensemble", "classification", "regression", "bagging"],
        pipeline: {
            explanation: "Random forests build many decision trees (typically 100-500), each trained on a bootstrap sample of the data and considering a random subset of features at each split. Predictions are aggregated by majority vote (classification) or averaging (regression). This reduces variance and overfitting compared to a single tree.",
            demonstration: "Train individual trees and watch the ensemble prediction stabilize. Toggle the number of trees and see how accuracy and decision boundaries smoothen.",
            practiceQuestions: [
                { question: "How does a random forest reduce overfitting compared to a single decision tree?", options: ["By using fewer features", "By averaging predictions across many diverse trees", "By using a smaller dataset", "By increasing tree depth"], correctAnswer: 1, explanation: "Ensemble averaging reduces the variance that causes individual trees to overfit.", difficulty: 3 },
                { question: "What is bagging?", options: ["A feature selection method", "Bootstrap aggregating — training on random subsets with replacement", "A regularization technique", "A type of neural network"], correctAnswer: 1, explanation: "Bagging trains each model on a bootstrap (random with replacement) sample of the training data.", difficulty: 3 },
                { question: "What is feature importance in random forests?", options: ["The number of features", "A measure of how much each feature contributes to predictions", "Feature scaling", "Feature encoding"], correctAnswer: 1, explanation: "Feature importance quantifies each feature's contribution to reducing impurity across all trees.", difficulty: 2 },
            ],
            applicationTask: "Train a random forest on a customer churn dataset. Compare its performance against a single decision tree and report feature importances.",
            evaluationCriteria: "Random forest outperforms the single tree on test accuracy, and top-3 features are correctly identified.",
        },
    },
    {
        conceptId: "pca",
        title: "Principal Component Analysis",
        description: "A dimensionality reduction technique that projects data onto the directions of maximum variance.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["data_preprocessing"],
        tags: ["unsupervised", "dimensionality-reduction", "linear-algebra"],
        pipeline: {
            explanation: "PCA finds orthogonal directions (principal components) that capture the most variance in the data. It involves: (1) standardizing features, (2) computing the covariance matrix, (3) extracting eigenvectors (loading vectors), and (4) projecting data onto the top-K eigenvectors. PCA is useful for visualization, noise reduction, and speeding up other algorithms.",
            demonstration: "Visualize high-dimensional data projected onto 2D/3D principal components. See the explained variance ratio change as you add more components.",
            practiceQuestions: [
                { question: "What do eigenvalues represent in PCA?", options: ["Feature importance", "The amount of variance explained by each principal component", "Cluster assignments", "Learning rate"], correctAnswer: 1, explanation: "Each eigenvalue indicates how much variance is captured along the corresponding eigenvector direction.", difficulty: 3 },
                { question: "When is PCA useful?", options: ["When you have too few features", "When you want to reduce dimensionality while preserving variance", "When labels are needed", "When data is already 2D"], correctAnswer: 1, explanation: "PCA is useful for high-dimensional data where you want to reduce features while keeping most information.", difficulty: 2 },
                { question: "What preprocessing step is essential before PCA?", options: ["One-hot encoding", "Feature standardization (zero mean, unit variance)", "Label encoding", "Outlier addition"], correctAnswer: 1, explanation: "PCA is affected by feature scales, so standardization ensures all features contribute equally.", difficulty: 3 },
            ],
            applicationTask: "Apply PCA to a high-dimensional dataset (50+ features). Plot the cumulative explained variance and determine how many components retain 95% of the variance.",
            evaluationCriteria: "Correctly identifies the number of components for 95% variance and provides a 2D scatter plot colored by class labels.",
        },
    },
    {
        conceptId: "cross_validation",
        title: "Cross-Validation",
        description: "A model evaluation technique that partitions data into multiple folds to estimate generalization performance.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: ["linear_regression"],
        tags: ["evaluation", "validation", "model-selection"],
        pipeline: {
            explanation: "K-fold cross-validation splits data into K equal folds. The model is trained K times, each time using K-1 folds for training and 1 fold for validation. The average validation score provides a robust performance estimate. Stratified K-fold ensures class balance in each fold. Leave-one-out CV is K-fold where K = N.",
            demonstration: "Visualize data splitting into folds. See how training and validation sets rotate across folds, and watch the mean score stabilize as folds complete.",
            practiceQuestions: [
                { question: "Why use cross-validation instead of a single train/test split?", options: ["It is faster", "It provides a more reliable estimate of model performance", "It uses less data", "It only works with large datasets"], correctAnswer: 1, explanation: "Cross-validation averages performance across multiple splits, reducing variance in the estimate.", difficulty: 2 },
                { question: "What is stratified K-fold?", options: ["K-fold with data augmentation", "K-fold that maintains class proportions in each fold", "K-fold with feature selection", "K-fold with time ordering"], correctAnswer: 1, explanation: "Stratification ensures each fold has approximately the same percentage of samples of each class.", difficulty: 2 },
                { question: "What is a typical value for K?", options: ["2", "5 or 10", "100", "1"], correctAnswer: 1, explanation: "K=5 or K=10 is commonly used as a good tradeoff between bias and variance in the evaluation estimate.", difficulty: 1 },
            ],
            applicationTask: "Compare three models (linear regression, decision tree, random forest) on the same dataset using 5-fold cross-validation. Report mean and standard deviation of scores.",
            evaluationCriteria: "All three models are correctly evaluated with mean ± std scores, and the best model is justified.",
        },
    },
];

async function seed() {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/adiptify";
    await mongoose.connect(MONGO_URI, {
        dbName: process.env.MONGO_DB || "adiptify",
        serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");

    // Clear existing concepts
    await Concept.deleteMany({});
    console.log("🗑️  Cleared existing concepts");

    // Insert new concepts
    await Concept.insertMany(concepts);
    console.log(`✅ Seeded ${concepts.length} concepts`);

    await mongoose.disconnect();
    console.log("👋 Done");
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
