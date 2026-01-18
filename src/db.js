/**
 * src/db.js
 * Gerenciador do IndexedDB para a aplicação SHIFT.
 * Responsável por toda a persistência de dados local (Local First).
 */

const DB_NAME = 'shift_db';
const DB_VERSION = 1;

class DbManager {
    constructor() {
        this.db = null;
        this.isReady = false;
    }

    /**
     * Inicializa a conexão com o banco de dados.
     * Cria as Stores se for a primeira vez.
     * @returns {Promise<void>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Erro ao abrir banco de dados:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                console.log("Banco de dados SHIFT inicializado com sucesso.");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. Store: Profiles (Perfis de Jornada)
                if (!db.objectStoreNames.contains('profiles')) {
                    const profileStore = db.createObjectStore('profiles', { keyPath: 'id', autoIncrement: true });
                    profileStore.createIndex('name', 'name', { unique: true });
                    
                    // Seed inicial será feito após a conexão abrir, mas podemos definir a estrutura aqui
                }

                // 2. Store: Collaborators (Colaboradores)
                if (!db.objectStoreNames.contains('collaborators')) {
                    const collabStore = db.createObjectStore('collaborators', { keyPath: 'id', autoIncrement: true });
                    collabStore.createIndex('name', 'name', { unique: false });
                    collabStore.createIndex('search_name', 'search_name', { unique: false }); // Nome normalizado para busca
                }

                // 3. Store: Daily Records (Registros do Dia)
                if (!db.objectStoreNames.contains('daily_records')) {
                    const recordStore = db.createObjectStore('daily_records', { keyPath: 'id', autoIncrement: true });
                    recordStore.createIndex('date', 'date', { unique: false });
                    recordStore.createIndex('collaborator_id', 'collaborator_id', { unique: false });
                    // Índice composto para buscar registro único de um colaborador em uma data
                    recordStore.createIndex('collab_date', ['collaborator_id', 'date'], { unique: true });
                }
            };
        }).then(() => {
            return this.seedDefaultData();
        });
    }

    /**
     * Popula o banco com dados padrão se estiver vazio.
     */
    async seedDefaultData() {
        const count = await this.count('profiles');
        if (count === 0) {
            console.log("Seeding perfil padrão 6x1...");
            const tx = this.db.transaction(['profiles'], 'readwrite');
            const store = tx.objectStore('profiles');
            
            // Definição do Perfil 6x1
            // 7h20 trabalho = 440 minutos
            // 1h00 almoço min = 60 minutos
            // 1h40 almoço target = 100 minutos
            // 2h00 extra max = 120 minutos
            store.add({
                name: '6x1',
                work_target_min: 440,
                lunch_min_limit: 60,
                lunch_target: 100,
                max_extra: 120
            });
            
            return new Promise((resolve) => {
                tx.oncomplete = () => resolve();
            });
        }
    }

    /**
     * Helper genérico para contar registros
     */
    count(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================================
    // MÉTODOS DE COLABORADORES
    // ============================================================

    /**
     * Busca colaboradores por nome (parcial).
     * @param {string} query - Texto da busca.
     * @returns {Promise<Array>} Lista de colaboradores.
     */
    async searchCollaborators(query) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['collaborators', 'profiles'], 'readonly');
            const store = tx.objectStore('collaborators');
            const profileStore = tx.objectStore('profiles');
            const results = [];
            
            // Normaliza a query para comparação
            const normalizedQuery = query.toLowerCase().trim();

            const request = store.openCursor();

            request.onsuccess = async (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const collab = cursor.value;
                    // Filtro simples em memória (suficiente para < 5000 registros locais)
                    if (collab.search_name.includes(normalizedQuery)) {
                        
                        // Busca o nome do perfil para retornar junto
                        // Nota: Em IDB puro, joins manuais são necessários ou feitos na UI.
                        // Aqui faremos um "join" simplificado na lógica ou retornamos o ID.
                        // Vamos retornar o objeto puro e deixar a UI buscar o perfil se precisar,
                        // ou carregar perfis em cache. Para simplificar, retornamos o ID do perfil.
                        results.push(collab);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Registra um novo colaborador.
     * @param {string} name 
     * @param {number} profileId 
     * @returns {Promise<number>} ID do novo colaborador.
     */
    async addCollaborator(name, profileId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['collaborators'], 'readwrite');
            const store = tx.objectStore('collaborators');
            
            const newCollab = {
                name: name,
                search_name: name.toLowerCase(), // Otimização para busca
                profile_id: Number(profileId),
                created_at: new Date().toISOString()
            };

            const request = store.add(newCollab);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca um colaborador pelo ID.
     */
    async getCollaboratorById(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['collaborators'], 'readonly');
            const store = tx.objectStore('collaborators');
            const request = store.get(Number(id));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================================
    // MÉTODOS DE REGISTROS DIÁRIOS
    // ============================================================

    /**
     * Busca todos os registros de uma data específica.
     * @param {string} dateStr - Formato YYYY-MM-DD.
     * @returns {Promise<Array>} Lista de registros populados com dados do colaborador.
     */
    async getDailyRecords(dateStr) {
        // Precisamos fazer um "Join" manual: Records + Collaborators + Profiles
        // 1. Pegar todos records da data
        // 2. Para cada record, pegar dados do colaborador
        // 3. Pegar dados do perfil
        
        return new Promise(async (resolve, reject) => {
            try {
                const tx = this.db.transaction(['daily_records', 'collaborators', 'profiles'], 'readonly');
                const recordStore = tx.objectStore('daily_records');
                const collabStore = tx.objectStore('collaborators');
                const profileStore = tx.objectStore('profiles');
                
                const index = recordStore.index('date');
                const request = index.getAll(dateStr);

                request.onsuccess = async () => {
                    const records = request.result;
                    const populatedRecords = [];

                    // Como IDB é assíncrono e baseado em eventos, fazer loops com awaits dentro de transaction
                    // pode ser tricky se a transação fechar (autocommit).
                    // Para leitura, é mais seguro buscar os records e depois fazer buscas individuais 
                    // ou carregar todos colaboradores em memória se forem poucos.
                    // Vamos usar Promise.all para resolver as dependências.

                    // Precisamos abrir uma nova transação ou garantir que essa não feche.
                    // A estratégia mais segura em Vanilla JS sem wrappers complexos:
                    // Pegar os IDs necessários e fazer uma segunda query em lote ou individual.
                    
                    const collabIds = records.map(r => r.collaborator_id);
                    // Hack simples: Carregar colaboradores um a um (performance ok para Local First com < 100 itens na tela)
                    
                    // Faremos a população fora da query principal para evitar complexidade de transação.
                    resolve({ records, collabIds });
                };
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        }).then(async ({ records, collabIds }) => {
            if (records.length === 0) return [];

            // Popula dados complementares
            const populated = [];
            for (let record of records) {
                const collab = await this.getCollaboratorById(record.collaborator_id);
                const profile = await this.getProfileById(collab.profile_id);
                populated.push({
                    ...record,
                    collaborator_name: collab.name,
                    profile_name: profile.name,
                    profile_data: profile
                });
            }
            return populated;
        });
    }

    /**
     * Salva ou atualiza um registro diário.
     * @param {Object} recordData 
     */
    async saveDailyRecord(recordData) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['daily_records'], 'readwrite');
            const store = tx.objectStore('daily_records');
            
            // put serve para insert ou update (se tiver id)
            const request = store.put(recordData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca um registro específico de um colaborador em uma data.
     */
    async getRecordByCollabDate(collabId, dateStr) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['daily_records'], 'readonly');
            const store = tx.objectStore('daily_records');
            const index = store.index('collab_date');
            
            const request = index.get([Number(collabId), dateStr]);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca os últimos X registros de um colaborador (Histórico).
     */
    async getHistory(collabId, limit = 5) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['daily_records'], 'readonly');
            const store = tx.objectStore('daily_records');
            const index = store.index('collaborator_id');
            const range = IDBKeyRange.only(Number(collabId));
            
            // Cursor abrindo do final para o início (prev)
            const request = index.openCursor(range, 'prev');
            const results = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================================
    // MÉTODOS DE PERFIL
    // ============================================================

    async getProfileById(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['profiles'], 'readonly');
            const store = tx.objectStore('profiles');
            const request = store.get(Number(id));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getAllProfiles() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['profiles'], 'readonly');
            const store = tx.objectStore('profiles');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Exporta uma instância única (Singleton)
const db = new DbManager();
export default db;