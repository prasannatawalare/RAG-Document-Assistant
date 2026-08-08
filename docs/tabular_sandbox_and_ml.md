# RDA: Tabular Sandbox & Local ML Services

This document details two highly unique technical components of the **RAG Document Assistant (RDA)** project: the **V8 JavaScript VM Sandbox** for tabular data analysis and the **pure JavaScript local Machine Learning Service**.

---

## 💻 1. The V8 JavaScript VM Sandbox

Traditional RAG struggles with structured tables (CSV/Excel) because chunking rows destroys the row-column relationship, and LLMs are notoriously poor at performing mathematical calculations (averages, sums, ratios) over large text blobs.

### The Programmatic Sandbox Solution
Instead of feeding raw table data to the LLM, our system uses a **Code-Generation & Sandbox Execution (Programmatic RAG)** pattern:

```
[User Question] -> (Gemini LLM) -> [Writes JS Code] -> (Node.js V8 VM) -> [Executes Code on File] -> [Returns Result + Charts]
```

### Sandbox Execution Context Setup
The system uses the Node.js standard `vm` (Virtual Machine) module to compile and execute the generated code inside a restricted context:

```javascript
const sandboxContext = {
  console: {
    log: (...args) => logger.info(`[Sandbox Console]: ${args.join(' ')}`),
    error: (...args) => logger.error(`[Sandbox Console Error]: ${args.join(' ')}`),
  },
  require: (moduleName) => {
    if (moduleName === 'fs') return fs;
    if (moduleName === 'path') return path;
    if (moduleName === 'csv-parse/sync') return { parse };
    if (moduleName === 'xlsx') return XLSX;
    throw new Error(`Module "${moduleName}" is blocked in sandbox environment`);
  },
  module: { exports: null },
  exports: {},
  Buffer: Buffer,
};

vm.createContext(sandboxContext);
vm.runInContext(code, sandboxContext, { 
  timeout: 5000, // 5 seconds max runtime
  filename: 'sandbox_agent.js'
});
```

### Security Measures in Sandbox
To prevent malicious code from compromising the local server, the VM is restricted:
1. **Network Blocked**: The script has no access to `http`, `https`, or database connections.
2. **Infinite Loop Protection**: A `timeout: 5000` configuration kills the execution thread if it runs for more than 5 seconds.
3. **Restricted File System Access**: While it can import `fs` to read the active uploaded file, it does not inherit global processes, environment keys, or write permissions beyond local folders.

---

## 📊 2. Local Machine Learning Service (`mlService.js`)

A core feature of the system is the ability to train machine learning models locally on uploaded tabular datasets in pure JavaScript, without Python, Scikit-Learn, or external APIs.

### 📈 Model A: Multiple Linear Regression (MLR)
Used to predict a continuous target variable $y$ based on multiple independent features $X$.
$$\mathbf{y} = \mathbf{X}\boldsymbol{\beta} + \boldsymbol{\epsilon}$$

#### Mathematical Implementation
To solve for the coefficient weight vector $\boldsymbol{\beta}$ (including intercept), we implement the **Normal Equation**:
$$\boldsymbol{\beta} = (\mathbf{X}^T\mathbf{X})^{-1}\mathbf{X}^T\mathbf{y}$$

1. **Matrix Helper Functions**: We implemented custom JavaScript solvers for Matrix Transpose ($\mathbf{X}^T$), Matrix Multiplication, and Matrix Inversion ($\mathbf{X}^{-1}$) using **Gauss-Jordan Elimination with partial pivoting**.
2. **Matrix Invertibility Check**: If features are perfectly correlated, the determinant is zero (singular matrix). The code checks for this and throws an error:
   ```javascript
   if (Math.abs(pivot) < 1e-10) {
     throw new Error("Matrix is singular. Check for perfectly correlated feature columns.");
   }
   ```
3. **Evaluation Metrics**:
   * **Mean Absolute Error (MAE)**: $\frac{1}{n}\sum |y_i - \hat{y}_i|$
   * **Mean Squared Error (MSE)**: $\frac{1}{n}\sum (y_i - \hat{y}_i)^2$
   * **Coefficient of Determination ($R^2$)**: $1 - \frac{SS_{res}}{SS_{tot}}$

---

### 🏷️ Model B: Naive Bayes Classification
Used to predict a categorical target class $C$ given feature variables $X = (x_1, x_2, \dots, x_d)$.
$$P(C_k \mid x_1, \dots, x_d) \propto P(C_k) \prod_{i=1}^d P(x_i \mid C_k)$$

#### Mathematical Implementation
Our implementation supports **Hybrid Naive Bayes** (handling both continuous and discrete columns):

1. **Continuous Features (Gaussian PDF)**: If a column is numeric, we compute the mean ($\mu$) and variance ($\sigma^2$) for each class. The probability density is computed using the Gaussian Probability Density Function:
   $$P(x_i \mid C_k) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x_i - \mu)^2}{2\sigma^2}\right)$$
2. **Categorical Features (Laplace Smoothing)**: If a column contains strings, we compute frequency counts. To prevent zero probabilities for unseen categories, we apply Laplace smoothing:
   $$P(x_i \mid C_k) = \frac{\text{count}(x_i \mid C_k) + 1}{\text{total\_count}(C_k) + |V|}$$
   where $|V|$ is the number of unique feature values.
3. **Log Probabilities**: To prevent floating-point underflow (multiplying many tiny decimals together), we sum natural logs:
   $$\ln P(C_k \mid X) \propto \ln P(C_k) + \sum_{i=1}^d \ln P(x_i \mid C_k)$$
4. **Performance Evaluation**: Generates a confusion matrix and calculates **Macro F1-Score**, **Precision**, and **Recall**.

---

### 🎯 Model C: K-Means Clustering
An unsupervised learning algorithm to group data into $K$ clusters by minimizing distances.

#### Mathematical Implementation
1. **Centroid Initialization**: Centroids are randomly selected from actual dataset coordinates to prevent empty clusters.
2. **Euclidean Distance calculation**:
   $$\text{Dist}(p, c)^2 = \sum_{j=1}^d (p_j - c_j)^2$$
3. **Expectation-Maximization Loop**:
   * **Assignment Step**: Assign each data point to the closest centroid.
   * **Update Step**: Recompute centroids by taking the average coordinate of all points in the cluster.
   * **Convergence Check**: Repeat until assignments stop changing or the 100 iteration limit is reached.
4. **Inertia Metric**: Sum of squared distances from points to their assigned centroids (Within-Cluster Sum of Squares).
