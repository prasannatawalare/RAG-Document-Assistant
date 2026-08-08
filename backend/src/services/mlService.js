import logger from '../utils/logger.js';

// Matrix Helper Functions for Linear Regression
const transpose = (A) => A[0].map((_, colIdx) => A.map(row => row[colIdx]));

const multiply = (A, B) => {
  const rowsA = A.length, colsA = A[0].length;
  const rowsB = B.length, colsB = B[0].length;
  if (colsA !== rowsB) throw new Error('Incompatible matrix dimensions for multiplication.');
  
  const C = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
};

const invert = (M) => {
  const n = M.length;
  // Create augmented matrix [M | I]
  const A = M.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))]);
  
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    // Swap rows
    const tmp = A[maxRow];
    A[maxRow] = A[i];
    A[i] = tmp;
    
    // Make pivot 1
    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-10) {
      throw new Error("Matrix is singular and cannot be inverted. Check for perfectly correlated feature columns.");
    }
    for (let j = i; j < 2 * n; j++) {
      A[i][j] /= pivot;
    }
    
    // Eliminate column elements in other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const c = A[k][i];
        for (let j = i; j < 2 * n; j++) {
          A[k][j] -= c * A[i][j];
        }
      }
    }
  }
  // Extract inverse matrix
  return A.map(row => row.slice(n));
};

class MLService {
  /**
   * Trains a Multiple Linear Regression model: y = X * beta
   */
  trainRegression(data, features, target) {
    logger.info(`Training Linear Regression: Target = ${target}, Features = [${features.join(', ')}]`);
    
    // Filter rows where target or features are missing/NaN
    const cleanData = data.filter(row => {
      if (row[target] === undefined || row[target] === null || isNaN(Number(row[target]))) return false;
      return features.every(f => row[f] !== undefined && row[f] !== null && !isNaN(Number(row[f])));
    });

    if (cleanData.length < features.length + 2) {
      throw new Error(`Insufficient clean rows (${cleanData.length}) to train model with ${features.length} features.`);
    }

    const n = cleanData.length;
    const y = cleanData.map(row => [Number(row[target])]);
    
    // Construct X matrix (with first column as 1s for intercept)
    const X = cleanData.map(row => [1, ...features.map(f => Number(row[f]))]);

    // beta = (X^T * X)^(-1) * X^T * y
    const XT = transpose(X);
    const XTX = multiply(XT, X);
    const XTX_inv = invert(XTX);
    const XTy = multiply(XT, y);
    const beta = multiply(XTX_inv, XTy);

    // Extract intercept and coefficients
    const intercept = beta[0][0];
    const coefficients = {};
    features.forEach((feat, idx) => {
      coefficients[feat] = beta[idx + 1][0];
    });

    // Evaluate predictions and metrics
    let sumSquaredResiduals = 0;
    let sumAbsoluteError = 0;
    let sumY = 0;
    const predictions = [];

    cleanData.forEach((row, idx) => {
      const actual = y[idx][0];
      let pred = intercept;
      features.forEach(f => {
        pred += coefficients[f] * Number(row[f]);
      });
      predictions.push(pred);

      sumSquaredResiduals += Math.pow(actual - pred, 2);
      sumAbsoluteError += Math.abs(actual - pred);
      sumY += actual;
    });

    const meanY = sumY / n;
    let sumSquaredTotal = 0;
    y.forEach(val => {
      sumSquaredTotal += Math.pow(val[0] - meanY, 2);
    });

    const r2 = sumSquaredTotal === 0 ? 0 : 1 - (sumSquaredResiduals / sumSquaredTotal);
    const mae = sumAbsoluteError / n;
    const mse = sumSquaredResiduals / n;

    // Generate readable formula
    let formula = `${target} = ${intercept.toFixed(4)}`;
    features.forEach(f => {
      const coef = coefficients[f];
      formula += ` ${coef >= 0 ? '+' : '-'} ${Math.abs(coef).toFixed(4)} * ${f}`;
    });

    return {
      success: true,
      taskType: 'regression',
      metrics: {
        rSquared: r2,
        meanAbsoluteError: mae,
        meanSquaredError: mse,
        sampleSize: n
      },
      model: {
        intercept,
        coefficients,
        formula
      },
      predictions: cleanData.slice(0, 100).map((row, idx) => ({
        actual: y[idx][0],
        predicted: predictions[idx],
        rowNumber: idx + 1
      }))
    };
  }

  /**
   * Trains a Gaussian & Categorical Naive Bayes Classifier
   */
  trainClassification(data, features, target) {
    logger.info(`Training Naive Bayes Classification: Target = ${target}, Features = [${features.join(', ')}]`);

    // Clean data: drop rows with nulls in features or target
    const cleanData = data.filter(row => {
      if (row[target] === undefined || row[target] === null) return false;
      return features.every(f => row[f] !== undefined && row[f] !== null);
    });

    if (cleanData.length < 5) {
      throw new Error(`Insufficient clean rows (${cleanData.length}) to train classification model.`);
    }

    const n = cleanData.length;
    
    // 1. Identify classes and compute prior probabilities: P(C)
    const classCounts = {};
    cleanData.forEach(row => {
      const c = String(row[target]);
      classCounts[c] = (classCounts[c] || 0) + 1;
    });

    const classes = Object.keys(classCounts);
    const priors = {};
    classes.forEach(c => {
      priors[c] = classCounts[c] / n;
    });

    // 2. Compute feature conditional distributions per class
    // For each feature, check if it's numeric or categorical
    const featureMetadata = {};
    features.forEach(f => {
      const isNumeric = cleanData.every(row => !isNaN(Number(row[f])));
      featureMetadata[f] = { isNumeric };
    });

    const modelParams = {};
    classes.forEach(c => {
      modelParams[c] = {};
      const classRows = cleanData.filter(row => String(row[target]) === c);

      features.forEach(f => {
        if (featureMetadata[f].isNumeric) {
          // Compute mean and variance for Gaussian NB
          const vals = classRows.map(row => Number(row[f]));
          const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
          const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
          modelParams[c][f] = {
            mean,
            variance: variance || 1e-4 // Prevent division by zero
          };
        } else {
          // Compute frequency counts with Laplace smoothing for Categorical NB
          const freqs = {};
          classRows.forEach(row => {
            const val = String(row[f]);
            freqs[val] = (freqs[val] || 0) + 1;
          });
          modelParams[c][f] = {
            freqs,
            totalCount: classRows.length
          };
        }
      });
    });

    // Prediction helper function
    const predictRow = (row) => {
      let bestClass = classes[0];
      let bestLogProb = -Infinity;

      classes.forEach(c => {
        let logProb = Math.log(priors[c]);

        features.forEach(f => {
          if (featureMetadata[f].isNumeric) {
            const val = Number(row[f]);
            const { mean, variance } = modelParams[c][f];
            // Gaussian Probability Density Function
            const prob = (1 / Math.sqrt(2 * Math.PI * variance)) * 
                         Math.exp(-Math.pow(val - mean, 2) / (2 * variance));
            logProb += Math.log(Math.max(prob, 1e-9)); // Prevent log(0)
          } else {
            const val = String(row[f]);
            const { freqs, totalCount } = modelParams[c][f];
            const uniqueVals = new Set(cleanData.map(r => String(r[f]))).size;
            // Laplace smoothed categorical probability
            const count = freqs[val] || 0;
            const prob = (count + 1) / (totalCount + uniqueVals);
            logProb += Math.log(prob);
          }
        });

        if (logProb > bestLogProb) {
          bestLogProb = logProb;
          bestClass = c;
        }
      });

      return bestClass;
    };

    // 3. Make predictions on training set & evaluate performance
    let correct = 0;
    const confusionMatrix = {};
    classes.forEach(c1 => {
      confusionMatrix[c1] = {};
      classes.forEach(c2 => {
        confusionMatrix[c1][c2] = 0;
      });
    });

    const predictions = [];
    cleanData.forEach((row, idx) => {
      const actual = String(row[target]);
      const predicted = predictRow(row);
      predictions.push(predicted);

      if (actual === predicted) correct++;
      confusionMatrix[actual][predicted]++;
    });

    const accuracy = correct / n;

    // Macro Precision and Recall calculations
    let macroPrecisionSum = 0;
    let macroRecallSum = 0;

    classes.forEach(c => {
      let tp = confusionMatrix[c][c];
      let fp = 0;
      let fn = 0;

      classes.forEach(other => {
        if (other !== c) {
          fp += confusionMatrix[other][c];
          fn += confusionMatrix[c][other];
        }
      });

      const precision = (tp + fp) === 0 ? 0 : tp / (tp + fp);
      const recall = (tp + fn) === 0 ? 0 : tp / (tp + fn);

      macroPrecisionSum += precision;
      macroRecallSum += recall;
    });

    const precision = macroPrecisionSum / classes.length;
    const recall = macroRecallSum / classes.length;
    const f1Score = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    return {
      success: true,
      taskType: 'classification',
      classes,
      metrics: {
        accuracy,
        precision,
        recall,
        f1Score,
        sampleSize: n
      },
      confusionMatrix,
      predictions: cleanData.slice(0, 100).map((row, idx) => ({
        actual: String(row[target]),
        predicted: predictions[idx],
        rowNumber: idx + 1
      }))
    };
  }

  /**
   * K-Means Clustering on numerical features
   */
  trainClustering(data, features, k = 3) {
    logger.info(`Training K-Means Clustering: K = ${k}, Features = [${features.join(', ')}]`);

    // Clean data: drop rows with missing values in features
    const cleanData = data.filter(row => 
      features.every(f => row[f] !== undefined && row[f] !== null && !isNaN(Number(row[f])))
    );

    if (cleanData.length < k + 1) {
      throw new Error(`Insufficient clean rows (${cleanData.length}) to run clustering for k = ${k}.`);
    }

    const points = cleanData.map(row => features.map(f => Number(row[f])));
    const n = points.length;
    const numFeatures = features.length;

    // 1. Initialize Centroids randomly from existing data points
    let centroids = [];
    const usedIndices = new Set();
    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * n);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        centroids.push([...points[idx]]);
      }
    }

    let assignments = Array(n).fill(-1);
    let centroidsChanged = true;
    let iter = 0;
    const maxIter = 100;

    // Distance metric: Squared Euclidean Distance
    const getDistanceSq = (p1, p2) => 
      p1.reduce((sum, val, idx) => sum + Math.pow(val - p2[idx], 2), 0);

    // 2. Loop until convergence
    while (centroidsChanged && iter < maxIter) {
      centroidsChanged = false;
      iter++;

      // Assignment step
      const newAssignments = [];
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let bestCluster = 0;

        for (let j = 0; j < k; j++) {
          const dist = getDistanceSq(points[i], centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = j;
          }
        }
        newAssignments.push(bestCluster);
      }

      // Check if assignments changed
      for (let i = 0; i < n; i++) {
        if (assignments[i] !== newAssignments[i]) {
          centroidsChanged = true;
          assignments = newAssignments;
          break;
        }
      }

      if (!centroidsChanged) break;

      // Recompute centroids step
      const sums = Array(k).fill(0).map(() => Array(numFeatures).fill(0));
      const counts = Array(k).fill(0);

      for (let i = 0; i < n; i++) {
        const clusterIdx = assignments[i];
        counts[clusterIdx]++;
        for (let j = 0; j < numFeatures; j++) {
          sums[clusterIdx][j] += points[i][j];
        }
      }

      // If any cluster is empty, reinitialize its centroid randomly
      for (let j = 0; j < k; j++) {
        if (counts[j] === 0) {
          centroids[j] = [...points[Math.floor(Math.random() * n)]];
        } else {
          centroids[j] = sums[j].map(sum => sum / counts[j]);
        }
      }
    }

    // Calculate final Sum of Squared Errors (Inertia)
    let inertia = 0;
    for (let i = 0; i < n; i++) {
      inertia += getDistanceSq(points[i], centroids[assignments[i]]);
    }

    // Format centroids as key-value pairs
    const formattedCentroids = centroids.map((c, cIdx) => {
      const centroidObj = { clusterId: cIdx, count: assignments.filter(a => a === cIdx).length };
      features.forEach((f, fIdx) => {
        centroidObj[f] = c[fIdx];
      });
      return centroidObj;
    });

    return {
      success: true,
      taskType: 'clustering',
      k,
      metrics: {
        inertia,
        iterations: iter,
        sampleSize: n
      },
      centroids: formattedCentroids,
      predictions: cleanData.slice(0, 100).map((row, idx) => {
        const rowData = { rowNumber: idx + 1, clusterId: assignments[idx] };
        features.forEach(f => {
          rowData[f] = Number(row[f]);
        });
        return rowData;
      })
    };
  }
}

export default new MLService();
