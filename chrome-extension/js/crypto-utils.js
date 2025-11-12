/**
 * Chrome扩展加密工具函数库
 * 提供安全的数据加密、解密和密钥管理功能
 * 使用Web Crypto API实现AES-GCM加密算法
 */

class CryptoUtils {
    constructor() {
        // 存储当前会话的加密密钥
        this.currentKey = null;
        this.keyInfo = {
            algorithm: 'AES-GCM',
            keyLength: 256,
            generated: null,
            lastUsed: null
        };
        
        // 分块加密配置
        this.chunkSize = 1024 * 1024; // 1MB per chunk
        this.chunkConfig = {
            minChunkSize: 64 * 1024,  // 64KB minimum
            maxChunkSize: 16 * 1024 * 1024, // 16MB maximum
            overlap: 32 * 1024 // 32KB overlap for AES-GCM
        };
        
        // 错误处理配置
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 100, // ms
            backoffMultiplier: 2
        };
        
        // 日志配置
        this.debugMode = false;
        this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
        
        console.log('🔐 CryptoUtils initialized');
    }

    /**
     * 启用或禁用调试模式
     * @param {boolean} enabled - 是否启用调试
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.log('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * 设置日志级别
     * @param {string} level - 日志级别
     */
    setLogLevel(level) {
        const validLevels = ['debug', 'info', 'warn', 'error'];
        if (validLevels.includes(level)) {
            this.logLevel = level;
            this.log('info', `Log level set to: ${level}`);
        }
    }

    /**
     * 内部日志方法
     * @param {string} level - 日志级别
     * @param {string} message - 日志消息
     * @param {any} data - 附加数据
     */
    log(level, message, data = null) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevel = levels[this.logLevel];
        const messageLevel = levels[level];
        
        if (this.debugMode || messageLevel >= currentLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [CryptoUtils] [${level.toUpperCase()}]`;
            
            if (data) {
                console[level](`${prefix} ${message}`, data);
            } else {
                console[level](`${prefix} ${message}`);
            }
        }
    }

    /**
     * 检查Web Crypto API可用性
     * @returns {boolean} 是否支持Web Crypto API
     */
    isCryptoSupported() {
        const supported = !!(window.crypto && window.crypto.subtle);
        this.log('debug', 'Web Crypto API support check', { supported });
        return supported;
    }

    /**
     * 随机生成盐值
     * @param {number} length - 盐值长度（字节）
     * @returns {Promise<Uint8Array>} 盐值
     */
    async generateSalt(length = 16) {
        try {
            const salt = new Uint8Array(length);
            crypto.getRandomValues(salt);
            this.log('debug', 'Salt generated', { length });
            return salt;
        } catch (error) {
            this.log('error', 'Failed to generate salt', error);
            throw new Error(`盐值生成失败: ${error.message}`);
        }
    }

    /**
     * 派生加密密钥
     * @param {string|Uint8Array} password - 密码
     * @param {Uint8Array} salt - 盐值
     * @param {number} iterations - PBKDF2迭代次数
     * @returns {Promise<CryptoKey>} 派生密钥
     */
    async deriveKey(password, salt, iterations = 100000) {
        try {
            this.log('debug', 'Deriving key from password');
            
            const encoder = new TextEncoder();
            const passwordBuffer = typeof password === 'string' 
                ? encoder.encode(password) 
                : password;

            // 导入密码作为密钥材料
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveKey']
            );

            // 派生密钥
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: iterations,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['encrypt', 'decrypt']
            );

            this.log('debug', 'Key derivation successful', { iterations });
            return key;
        } catch (error) {
            this.log('error', 'Key derivation failed', error);
            throw new Error(`密钥派生失败: ${error.message}`);
        }
    }

    /**
     * 生成随机加密密钥
     * @returns {Promise<CryptoKey>} 随机生成的对称密钥
     */
    async generateKey() {
        try {
            this.log('debug', 'Generating new encryption key');
            
            const key = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true, // 可导出密钥用于存储
                ['encrypt', 'decrypt']
            );

            this.currentKey = key;
            this.keyInfo.generated = new Date().toISOString();
            this.keyInfo.lastUsed = new Date().toISOString();

            this.log('info', 'New encryption key generated');
            return key;
        } catch (error) {
            this.log('error', 'Key generation failed', error);
            throw new Error(`密钥生成失败: ${error.message}`);
        }
    }

    /**
     * 导出密钥为Base64格式
     * @param {CryptoKey} key - 要导出的密钥
     * @returns {Promise<string>} Base64格式的密钥
     */
    async exportKey(key) {
        try {
            const exported = await crypto.subtle.exportKey('raw', key);
            const exportedArray = new Uint8Array(exported);
            const base64Key = btoa(String.fromCharCode(...exportedArray));
            
            this.log('debug', 'Key exported as base64');
            return base64Key;
        } catch (error) {
            this.log('error', 'Key export failed', error);
            throw new Error(`密钥导出失败: ${error.message}`);
        }
    }

    /**
     * 从Base64格式导入密钥
     * @param {string} base64Key - Base64格式的密钥
     * @returns {Promise<CryptoKey>} 导入的密钥
     */
    async importKey(base64Key) {
        try {
            const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
            
            const key = await crypto.subtle.importKey(
                'raw',
                keyData,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,
                ['encrypt', 'decrypt']
            );

            this.log('debug', 'Key imported from base64');
            return key;
        } catch (error) {
            this.log('error', 'Key import failed', error);
            throw new Error(`密钥导入失败: ${error.message}`);
        }
    }

    /**
     * 生成初始化向量(IV)
     * @param {number} length - IV长度（字节），默认为12
     * @returns {Uint8Array} 随机IV
     */
    generateIV(length = 12) {
        const iv = new Uint8Array(length);
        crypto.getRandomValues(iv);
        this.log('debug', 'IV generated', { length });
        return iv;
    }

    /**
     * 加密数据
     * @param {string|Uint8Array|Object} data - 要加密的数据
     * @param {CryptoKey} key - 加密密钥
     * @param {Uint8Array} iv - 初始化向量
     * @returns {Promise<Object>} 加密结果
     */
    async encryptData(data, key, iv = null) {
        try {
            this.log('debug', 'Starting data encryption');
            
            // 生成IV如果未提供
            if (!iv) {
                iv = this.generateIV();
            }

            // 准备数据
            let dataBuffer;
            if (typeof data === 'string') {
                dataBuffer = new TextEncoder().encode(data);
            } else if (data instanceof Uint8Array) {
                dataBuffer = data;
            } else {
                dataBuffer = new TextEncoder().encode(JSON.stringify(data));
            }

            // 加密数据
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                dataBuffer
            );

            const result = {
                encrypted: new Uint8Array(encrypted),
                iv: iv,
                timestamp: new Date().toISOString(),
                originalSize: dataBuffer.length,
                algorithm: 'AES-GCM'
            };

            this.keyInfo.lastUsed = new Date().toISOString();
            this.log('info', 'Data encryption successful', { 
                originalSize: dataBuffer.length,
                encryptedSize: encrypted.byteLength 
            });

            return result;
        } catch (error) {
            this.log('error', 'Data encryption failed', error);
            throw new Error(`数据加密失败: ${error.message}`);
        }
    }

    /**
     * 解密数据
     * @param {Object} encryptedData - 加密的数据对象
     * @param {CryptoKey} key - 解密密钥
     * @returns {Promise<string|Uint8Array|Object>} 解密后的数据
     */
    async decryptData(encryptedData, key) {
        try {
            this.log('debug', 'Starting data decryption');
            
            const { encrypted, iv } = encryptedData;
            
            // 解密数据
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encrypted
            );

            this.keyInfo.lastUsed = new Date().toISOString();
            
            // 尝试解析为UTF-8字符串
            try {
                const decryptedText = new TextDecoder().decode(decrypted);
                this.log('info', 'Data decryption successful (text)');
                return decryptedText;
            } catch {
                // 如果不是UTF-8，返回Uint8Array
                this.log('info', 'Data decryption successful (binary)');
                return new Uint8Array(decrypted);
            }
        } catch (error) {
            this.log('error', 'Data decryption failed', error);
            throw new Error(`数据解密失败: ${error.message}`);
        }
    }

    /**
     * 分块加密大文件
     * @param {string|Uint8Array} data - 要加密的数据
     * @param {CryptoKey} key - 加密密钥
     * @param {Object} options - 选项
     * @returns {Promise<Object>} 分块加密结果
     */
    async encryptLargeData(data, key, options = {}) {
        try {
            this.log('debug', 'Starting large data encryption');
            
            const {
                chunkSize = this.chunkSize,
                minChunkSize = this.chunkConfig.minChunkSize,
                maxChunkSize = this.chunkConfig.maxChunkSize,
                overlap = this.chunkConfig.overlap
            } = options;

            // 准备数据
            let dataBuffer;
            if (typeof data === 'string') {
                dataBuffer = new TextEncoder().encode(data);
            } else if (data instanceof Uint8Array) {
                dataBuffer = data;
            } else {
                dataBuffer = new TextEncoder().encode(JSON.stringify(data));
            }

            const totalSize = dataBuffer.length;
            const chunks = [];
            
            // 计算实际分块大小
            const actualChunkSize = Math.max(minChunkSize, 
                Math.min(maxChunkSize, chunkSize));
            
            this.log('info', `Encrypting ${totalSize} bytes in chunks of ${actualChunkSize}`);

            for (let offset = 0; offset < totalSize; offset += actualChunkSize - overlap) {
                const endIndex = Math.min(offset + actualChunkSize, totalSize);
                const chunk = dataBuffer.slice(offset, endIndex);
                const chunkIV = this.generateIV();
                
                const encryptedChunk = await this.encryptData(chunk, key, chunkIV);
                chunks.push({
                    offset,
                    size: chunk.length,
                    encrypted: encryptedChunk.encrypted,
                    iv: encryptedChunk.iv
                });
            }

            const result = {
                type: 'chunked-encryption',
                totalSize,
                chunkCount: chunks.length,
                chunks,
                originalSize: totalSize,
                timestamp: new Date().toISOString(),
                metadata: {
                    chunkSize: actualChunkSize,
                    overlap,
                    algorithm: 'AES-GCM'
                }
            };

            this.log('info', `Large data encryption completed: ${chunks.length} chunks`);
            return result;
        } catch (error) {
            this.log('error', 'Large data encryption failed', error);
            throw new Error(`大文件加密失败: ${error.message}`);
        }
    }

    /**
     * 分块解密大文件
     * @param {Object} encryptedData - 加密的数据对象
     * @param {CryptoKey} key - 解密密钥
     * @returns {Promise<Uint8Array>} 解密后的完整数据
     */
    async decryptLargeData(encryptedData, key) {
        try {
            this.log('debug', 'Starting large data decryption');
            
            const { chunks, totalSize } = encryptedData;
            const decryptedChunks = [];
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                this.log('debug', `Decrypting chunk ${i + 1}/${chunks.length}`);
                
                const decryptedChunk = await this.decryptData({
                    encrypted: chunk.encrypted,
                    iv: chunk.iv
                }, key);
                
                decryptedChunks.push(decryptedChunk);
            }

            // 合并所有分块
            const totalLength = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            
            for (const chunk of decryptedChunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }

            this.log('info', `Large data decryption completed: ${totalLength} bytes`);
            return result;
        } catch (error) {
            this.log('error', 'Large data decryption failed', error);
            throw new Error(`大文件解密失败: ${error.message}`);
        }
    }

    /**
     * 存储加密密钥到Chrome存储
     * @param {string} keyName - 存储键名
     * @param {CryptoKey} key - 要存储的密钥
     * @param {Object} metadata - 额外元数据
     * @returns {Promise<void>}
     */
    async storeKey(keyName, key, metadata = {}) {
        try {
            this.log('debug', `Storing key: ${keyName}`);
            
            const exportedKey = await this.exportKey(key);
            const keyData = {
                key: exportedKey,
                algorithm: this.keyInfo.algorithm,
                keyLength: this.keyInfo.keyLength,
                generated: this.keyInfo.generated,
                lastUsed: this.keyInfo.lastUsed,
                metadata: metadata,
                stored: new Date().toISOString()
            };

            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ [keyName]: keyData }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });

            this.log('info', `Key stored successfully: ${keyName}`);
        } catch (error) {
            this.log('error', `Failed to store key: ${keyName}`, error);
            throw new Error(`密钥存储失败: ${error.message}`);
        }
    }

    /**
     * 从Chrome存储加载加密密钥
     * @param {string} keyName - 存储键名
     * @returns {Promise<CryptoKey|null>} 加载的密钥
     */
    async loadKey(keyName) {
        try {
            this.log('debug', `Loading key: ${keyName}`);
            
            const keyData = await new Promise((resolve, reject) => {
                chrome.storage.local.get([keyName], (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(result[keyName] || null);
                    }
                });
            });

            if (!keyData) {
                this.log('warn', `Key not found: ${keyName}`);
                return null;
            }

            const key = await this.importKey(keyData.key);
            this.currentKey = key;
            this.keyInfo = {
                ...this.keyInfo,
                ...keyData
            };

            this.log('info', `Key loaded successfully: ${keyName}`);
            return key;
        } catch (error) {
            this.log('error', `Failed to load key: ${keyName}`, error);
            throw new Error(`密钥加载失败: ${error.message}`);
        }
    }

    /**
     * 删除存储的加密密钥
     * @param {string} keyName - 存储键名
     * @returns {Promise<void>}
     */
    async removeKey(keyName) {
        try {
            this.log('debug', `Removing key: ${keyName}`);
            
            await new Promise((resolve, reject) => {
                chrome.storage.local.remove([keyName], () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });

            this.log('info', `Key removed successfully: ${keyName}`);
        } catch (error) {
            this.log('error', `Failed to remove key: ${keyName}`, error);
            throw new Error(`密钥删除失败: ${error.message}`);
        }
    }

    /**
     * 列出所有存储的密钥
     * @returns {Promise<Array>} 密钥列表
     */
    async listStoredKeys() {
        try {
            const allData = await new Promise((resolve, reject) => {
                chrome.storage.local.get(null, (items) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(items);
                    }
                });
            });

            const keys = Object.keys(allData).filter(keyName => {
                const item = allData[keyName];
                return item && item.key && item.algorithm === 'AES-GCM';
            });

            const keyList = keys.map(keyName => {
                const item = allData[keyName];
                return {
                    name: keyName,
                    algorithm: item.algorithm,
                    keyLength: item.keyLength,
                    generated: item.generated,
                    lastUsed: item.lastUsed,
                    stored: item.stored,
                    metadata: item.metadata || {}
                };
            });

            this.log('debug', 'Listed stored keys', { count: keyList.length });
            return keyList;
        } catch (error) {
            this.log('error', 'Failed to list stored keys', error);
            throw new Error(`密钥列表获取失败: ${error.message}`);
        }
    }

    /**
     * 使用重试机制执行操作
     * @param {Function} operation - 要执行的操作
     * @param {Object} options - 重试选项
     * @returns {Promise} 操作结果
     */
    async executeWithRetry(operation, options = {}) {
        const {
            maxRetries = this.retryConfig.maxRetries,
            retryDelay = this.retryConfig.retryDelay,
            backoffMultiplier = this.retryConfig.backoffMultiplier
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                this.log('warn', `Operation failed (attempt ${attempt + 1}/${maxRetries + 1})`, error);
                
                if (attempt < maxRetries) {
                    const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
                    this.log('debug', `Retrying in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        this.log('error', 'All retry attempts failed', lastError);
        throw lastError;
    }

    /**
     * 验证密钥有效性
     * @param {CryptoKey} key - 要验证的密钥
     * @returns {Promise<boolean>} 密钥是否有效
     */
    async validateKey(key) {
        try {
            // 测试加密解密操作
            const testData = new TextEncoder().encode('test-validation');
            const testIV = this.generateIV();
            
            const encrypted = await this.encryptData(testData, key, testIV);
            const decrypted = await this.decryptData(encrypted, key);
            
            const isValid = JSON.stringify(testData) === JSON.stringify(decrypted);
            this.log('debug', 'Key validation', { isValid });
            
            return isValid;
        } catch (error) {
            this.log('error', 'Key validation failed', error);
            return false;
        }
    }

    /**
     * 获取密钥使用统计信息
     * @returns {Object} 密钥统计信息
     */
    getKeyStats() {
        return {
            ...this.keyInfo,
            currentKeyExists: this.currentKey !== null,
            hasGeneratedKey: !!this.keyInfo.generated
        };
    }

    /**
     * 清理密钥缓存
     */
    clearKeyCache() {
        this.currentKey = null;
        this.keyInfo.lastUsed = new Date().toISOString();
        this.log('debug', 'Key cache cleared');
    }

    /**
     * 安全清理内存中的敏感数据
     * @param {any} data - 要清理的数据
     */
    secureClear(data) {
        if (data && typeof data === 'object') {
            if (data instanceof Uint8Array) {
                data.fill(0);
            } else if (Array.isArray(data)) {
                for (let i = 0; i < data.length; i++) {
                    this.secureClear(data[i]);
                }
            } else if (typeof data === 'object') {
                Object.keys(data).forEach(key => {
                    this.secureClear(data[key]);
                    data[key] = null;
                });
            }
        }
    }
}

// 创建全局实例
window.cryptoUtils = new CryptoUtils();

// 导出类和实例
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CryptoUtils, cryptoUtils };
}