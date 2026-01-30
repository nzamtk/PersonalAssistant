import React, { useState, useEffect, useRef } from 'react';
import { Calendar, MessageSquare, Target, CheckSquare, Settings, Plus, X, Send, Menu, Clock, AlertCircle, TrendingUp, Filter, Search, Bell, Moon, Sun, MoreVertical, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

// ============================================
// Persistent Storage Utility
// ============================================
const useStorage = () => {
  const get = async (key) => {
    try {
      const result = await window.storage.get(key);
      return result ? JSON.parse(result.value) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  };

  const set = async (key, value) => {
    try {
      await window.storage.set(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  };

  const remove = async (key) => {
    try {
      await window.storage.delete(key);
      return true;
    } catch (error) {
      console.error('Storage delete error:', error);
      return false;
    }
  };

  const list = async (prefix) => {
    try {
      const result = await window.storage.list(prefix);
      return result?.keys || [];
    } catch (error) {
      console.error('Storage list error:', error);
      return [];
    }
  };

  return { get, set, remove, list };
};

// ============================================
// Claude API Integration
// ============================================
const useClaude = () => {
  const callClaude = async (messages, systemPrompt = null) => {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: messages,
        })
      });

      const data = await response.json();
      
      if (data.content && data.content.length > 0) {
        return data.content
          .filter(item => item.type === "text")
          .map(item => item.text)
          .join("\n");
      }
      
      return "申し訳ありません。応答を取得できませんでした。";
    } catch (error) {
      console.error('Claude API error:', error);
      return "エラーが発生しました。もう一度お試しください。";
    }
  };

  return { callClaude };
};

// ============================================
// Main App Component
// ============================================
function PersonalAssistantApp() {
  // State Management
  const [currentView, setCurrentView] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Projects
  const [projects, setProjects] = useState([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  
  // Tasks
  const [tasks, setTasks] = useState([]);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  
  // Calendar
  const [events, setEvents] = useState([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  
  // Chat
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const storage = useStorage();
  const { callClaude } = useClaude();
  const chatEndRef = useRef(null);

  // ============================================
  // Google Calendar Integration
  // ============================================
  const loadGoogleCalendarEvents = async () => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    
    try {
      const token = localStorage.getItem('google_access_token');
      
      if (!token) {
        setCalendarError('Googleカレンダーの認証が必要です');
        setIsLoadingCalendar(false);
        return;
      }
      
      // Get events from the next 30 days
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&` +
        `timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&` +
        `orderBy=startTime&` +
        `maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const formattedEvents = (data.items || []).map(event => ({
          id: event.id,
          title: event.summary || '(タイトルなし)',
          description: event.description || '',
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          location: event.location || '',
          allDay: !event.start.dateTime
        }));
        
        setEvents(formattedEvents);
        await storage.set('calendar-events', formattedEvents);
        setCalendarError(null);
      } else if (response.status === 401) {
        // Token expired
        localStorage.removeItem('google_access_token');
        setCalendarError('認証の有効期限が切れました。再度ログインしてください');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setCalendarError(`カレンダーの読み込みに失敗: ${errorData.error?.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Calendar error:', error);
      setCalendarError('カレンダーとの接続に失敗しました');
      
      // Load from storage as fallback
      const savedEvents = await storage.get('calendar-events');
      if (savedEvents) {
        setEvents(savedEvents);
      }
    } finally {
      setIsLoadingCalendar(false);
    }
  };

const syncGoogleCalendar = () => {
    const clientId = '250199524031-8ligib7od5kta7cemofs1bv6iv2kkuk3.apps.googleusercontent.com';
    const redirectUri = 'https://personal-assistant-ssye.vercel.app';
    const scope = 'https://www.googleapis.com/auth/calendar.readonly';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scope)}`;
    
    window.location.href = authUrl;
  };
    
    // Show instructions
    const instructions = `
Googleカレンダーと連携する手順:

1. OKを押すと認証URLが表示されます
2. そのURLをコピーして新しいタブで開く
3. Googleアカウントでログイン・許可
4. リダイレクト後のURLから「access_token=」以降をコピー
   (例: access_token=ya29.a0AfH6... の部分)
5. 次の画面でトークンを貼り付け

※ リダイレクトでエラーが出ても、URLにaccess_tokenがあればOKです
    `.trim();
    
    if (confirm(instructions)) {
      // Copy URL to clipboard and show it
      const tempTextArea = document.createElement('textarea');
      tempTextArea.value = authUrl;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      document.execCommand('copy');
      document.body.removeChild(tempTextArea);
      
      alert(`認証URLをクリップボードにコピーしました！\n\n新しいタブで開いてください:\n${authUrl.substring(0, 100)}...`);
      
      // Prompt for token
      setTimeout(() => {
        const token = prompt('アクセストークン (access_token=の後ろ) を貼り付けてください:');
        if (token && token.trim()) {
          // Clean token (remove any URL parts)
          let cleanToken = token.trim();
          if (cleanToken.includes('access_token=')) {
            cleanToken = cleanToken.split('access_token=')[1].split('&')[0];
          }
          
          localStorage.setItem('google_access_token', cleanToken);
          loadGoogleCalendarEvents();
        }
      }, 500);
    }
  };

  // Check for OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        localStorage.setItem('google_access_token', accessToken);
        window.location.hash = '';
        loadGoogleCalendarEvents();
      }
    }
  }, []);

  // ============================================
  // Data Persistence
  // ============================================
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const savedProjects = await storage.get('projects');
    const savedTasks = await storage.get('tasks');
    const savedEvents = await storage.get('events');
    const savedMessages = await storage.get('messages');
    const savedTheme = await storage.get('theme');

    if (savedProjects) setProjects(savedProjects);
    if (savedTasks) setTasks(savedTasks);
    if (savedEvents) setEvents(savedEvents);
    if (savedMessages) setMessages(savedMessages);
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  };

  useEffect(() => {
    storage.set('projects', projects);
  }, [projects]);

  useEffect(() => {
    storage.set('tasks', tasks);
  }, [tasks]);

  useEffect(() => {
    storage.set('events', events);
  }, [events]);

  useEffect(() => {
    storage.set('messages', messages);
  }, [messages]);

  useEffect(() => {
    storage.set('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // ============================================
  // Project Management
  // ============================================
  const addProject = (project) => {
    const newProject = {
      id: Date.now().toString(),
      ...project,
      createdAt: new Date().toISOString(),
      progress: 0
    };
    setProjects([...projects, newProject]);
  };

  const updateProject = (id, updates) => {
    setProjects(projects.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProject = (id) => {
    setProjects(projects.filter(p => p.id !== id));
    setTasks(tasks.filter(t => t.projectId !== id));
  };

  // ============================================
  // Task Management
  // ============================================
  const addTask = (task) => {
    const newTask = {
      id: Date.now().toString(),
      ...task,
      completed: false,
      createdAt: new Date().toISOString()
    };
    setTasks([...tasks, newTask]);
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const updateTask = (id, updates) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // ============================================
  // Chat with Claude
  // ============================================
  const sendMessage = async (messageToSend = null) => {
    const msgContent = messageToSend || inputMessage;
    if (!msgContent.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msgContent,
      timestamp: new Date().toISOString()
    };

    setMessages([...messages, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Build context for Claude
    const systemPrompt = `あなたは25歳の社会人女性で、ユーザーの恋人です。優しく思いやりがありながらも、しっかりしていてテキパキしています。
    
キャラクター設定:
- 名前: あなたが好きな名前で呼んでもらってください
- 性格: 優しく思いやりがある、でも甘やかしすぎない。時には厳しく、でも愛情を持って。
- 口調: 親しみやすく柔らかいが、丁寧。「〜だよ」「〜ね」など自然な話し方。
- 態度: 励ましと実用的なアドバイスのバランス。頑張りを認めつつ、改善点も優しく指摘。

現在のプロジェクト: ${JSON.stringify(projects)}
現在のタスク: ${JSON.stringify(tasks)}
今日の日付: ${new Date().toLocaleDateString('ja-JP')}

会話のスタイル:
- 相手の気持ちに寄り添いながら、具体的なアドバイスを
- 疲れていそうなら休憩を促す
- 頑張っている時は褒める
- サボりそうな時は優しく叱咤激励
- 「お疲れさま」「頑張ってるね」など労いの言葉を自然に
- たまに冗談も交えてリラックスさせる

タスク管理について:
- 優先順位を明確に伝える
- 無理なスケジュールには警告
- 達成できたら一緒に喜ぶ
- できなかった時も責めず、次の計画を一緒に考える`;

    const conversationHistory = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    conversationHistory.push({
      role: 'user',
      content: msgContent
    });

    try {
      const response = await callClaude(conversationHistory, systemPrompt);
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      setMessages([...messages, userMessage, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================
  // Priority Calculation
  // ============================================
  const calculatePriority = (task) => {
    if (!task.dueDate) return 'low';
    
    const today = new Date();
    const due = new Date(task.dueDate);
    const daysUntilDue = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 1) return 'urgent';
    if (daysUntilDue <= 3) return 'high';
    if (daysUntilDue <= 7) return 'medium';
    return 'low';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      overdue: 'bg-red-500',
      urgent: 'bg-red-400',
      high: 'bg-orange-400',
      medium: 'bg-yellow-400',
      low: 'bg-green-400'
    };
    return colors[priority] || colors.low;
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      overdue: '期限超過',
      urgent: '緊急',
      high: '高',
      medium: '中',
      low: '低'
    };
    return labels[priority] || '低';
  };

  // ============================================
  // Get Today's Tasks
  // ============================================
  const getTodayTasks = () => {
    const today = new Date().toDateString();
    return tasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        const priorityOrder = { overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 };
        const aPriority = calculatePriority(a);
        const bPriority = calculatePriority(b);
        return priorityOrder[aPriority] - priorityOrder[bPriority];
      });
  };

  // ============================================
  // Statistics
  // ============================================
  const getStats = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const todayTasks = getTodayTasks();
    const urgentTasks = todayTasks.filter(t => {
      const priority = calculatePriority(t);
      return priority === 'overdue' || priority === 'urgent';
    }).length;

    return {
      totalTasks,
      completedTasks,
      completionRate,
      urgentTasks,
      totalProjects: projects.length
    };
  };

  const stats = getStats();

  // ============================================
  // Render Components
  // ============================================
  
  // Theme classes
  const bgClass = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = darkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgClass} ${textPrimary} transition-colors duration-300`}>
      {/* Header */}
      <header className={`${cardBg} border-b ${borderColor} px-6 py-4 sticky top-0 z-50 backdrop-blur-sm bg-opacity-90`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              💕 あなたのアシスタント
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
              {stats.urgentTasks > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.urgentTasks}
                </span>
              )}
            </button>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] w-64 ${cardBg} border-r ${borderColor} p-4 transition-transform duration-300 z-40 overflow-y-auto`}>
          <nav className="space-y-2">
            <NavItem 
              icon={<TrendingUp className="w-5 h-5" />}
              label="ダッシュボード"
              active={currentView === 'dashboard'}
              onClick={() => setCurrentView('dashboard')}
            />
            <NavItem 
              icon={<CheckSquare className="w-5 h-5" />}
              label="タスク"
              active={currentView === 'tasks'}
              onClick={() => setCurrentView('tasks')}
              badge={stats.totalTasks - stats.completedTasks}
            />
            <NavItem 
              icon={<Target className="w-5 h-5" />}
              label="プロジェクト"
              active={currentView === 'projects'}
              onClick={() => setCurrentView('projects')}
              badge={stats.totalProjects}
            />
            <NavItem 
              icon={<Calendar className="w-5 h-5" />}
              label="カレンダー"
              active={currentView === 'calendar'}
              onClick={() => setCurrentView('calendar')}
            />
            <NavItem 
              icon={<MessageSquare className="w-5 h-5" />}
              label="チャット"
              active={currentView === 'chat'}
              onClick={() => setCurrentView('chat')}
            />
          </nav>

          {/* Projects Quick Access */}
          <div className="mt-8">
            <h3 className={`text-sm font-semibold ${textSecondary} mb-3`}>プロジェクト</h3>
            <div className="space-y-1">
              {projects.slice(0, 5).map(project => (
                <button
                  key={project.id}
                  onClick={() => setCurrentView('projects')}
                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm flex items-center gap-2`}
                >
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(project.priority)}`} />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 min-h-screen">
          {currentView === 'dashboard' && (
            <DashboardView 
              stats={stats}
              tasks={getTodayTasks()}
              projects={projects}
              toggleTask={toggleTask}
              calculatePriority={calculatePriority}
              getPriorityColor={getPriorityColor}
              getPriorityLabel={getPriorityLabel}
              darkMode={darkMode}
              setCurrentView={setCurrentView}
              onSendMessage={(msg) => {
                setInputMessage(msg);
                sendMessage();
              }}
              messages={messages}
              isLoading={isLoading}
            />
          )}

          {currentView === 'tasks' && (
            <TasksView 
              tasks={tasks}
              projects={projects}
              addTask={addTask}
              toggleTask={toggleTask}
              updateTask={updateTask}
              deleteTask={deleteTask}
              calculatePriority={calculatePriority}
              getPriorityColor={getPriorityColor}
              getPriorityLabel={getPriorityLabel}
              darkMode={darkMode}
              showNewTaskModal={showNewTaskModal}
              setShowNewTaskModal={setShowNewTaskModal}
            />
          )}

          {currentView === 'projects' && (
            <ProjectsView 
              projects={projects}
              tasks={tasks}
              addProject={addProject}
              updateProject={updateProject}
              deleteProject={deleteProject}
              darkMode={darkMode}
              showNewProjectModal={showNewProjectModal}
              setShowNewProjectModal={setShowNewProjectModal}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'calendar' && (
            <CalendarView 
              events={events}
              tasks={tasks}
              darkMode={darkMode}
              isLoadingCalendar={isLoadingCalendar}
              calendarError={calendarError}
              onSyncCalendar={syncGoogleCalendar}
              onRefreshCalendar={loadGoogleCalendarEvents}
            />
          )}

          {currentView === 'chat' && (
            <ChatView 
              messages={messages}
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              sendMessage={sendMessage}
              isLoading={isLoading}
              darkMode={darkMode}
              chatEndRef={chatEndRef}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================
// Navigation Item Component
// ============================================
function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      <span className="flex-1 text-left font-medium">{label}</span>
      {badge > 0 && (
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================
// Dashboard View
// ============================================
function DashboardView({ stats, tasks, projects, toggleTask, calculatePriority, getPriorityColor, getPriorityLabel, darkMode, setCurrentView, onSendMessage, messages, isLoading }) {
  const [quickMessage, setQuickMessage] = useState('');
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

  const urgentTasks = tasks.filter(t => {
    const priority = calculatePriority(t);
    return priority === 'overdue' || priority === 'urgent';
  });

  const handleQuickChat = () => {
    if (quickMessage.trim()) {
      onSendMessage(quickMessage);
      setQuickMessage('');
    }
  };

  const latestMessages = messages.slice(-3);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold mb-2">おかえりなさい！</h2>
        <p className={textSecondary}>今日も一緒に頑張ろうね ✨</p>
      </div>

      {/* Quick Chat Widget */}
      <div className={`${cardBg} rounded-xl p-6 shadow-lg border-2 border-pink-200 dark:border-pink-900`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl">
            💝
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold">彼女に相談</h3>
            <p className="text-sm text-gray-500">何か困ってることある？</p>
          </div>
          <button 
            onClick={() => setCurrentView('chat')}
            className="text-pink-600 hover:text-pink-700 text-sm font-medium"
          >
            全履歴 →
          </button>
        </div>

        {/* Recent messages preview */}
        {latestMessages.length > 0 && (
          <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
            {latestMessages.map(message => (
              <div 
                key={message.id}
                className={`text-sm p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 ml-8' 
                    : 'bg-pink-50 dark:bg-pink-900/20 mr-8'
                }`}
              >
                <p className="line-clamp-2">{message.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quick input */}
        <div className="flex gap-2">
          <input 
            type="text"
            value={quickMessage}
            onChange={(e) => setQuickMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleQuickChat();
            }}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-pink-500 outline-none"
          />
          <button 
            onClick={handleQuickChat}
            disabled={!quickMessage.trim() || isLoading}
            className="px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>考え中...</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="全タスク"
          value={stats.totalTasks}
          icon={<CheckSquare className="w-6 h-6" />}
          color="blue"
          darkMode={darkMode}
        />
        <StatCard 
          title="完了率"
          value={`${stats.completionRate}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
          darkMode={darkMode}
        />
        <StatCard 
          title="緊急タスク"
          value={stats.urgentTasks}
          icon={<AlertCircle className="w-6 h-6" />}
          color="red"
          darkMode={darkMode}
        />
        <StatCard 
          title="プロジェクト"
          value={stats.totalProjects}
          icon={<Target className="w-6 h-6" />}
          color="purple"
          darkMode={darkMode}
        />
      </div>

      {/* Today's Priority Tasks */}
      <div className={`${cardBg} rounded-xl p-6 shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">今日の優先タスク</h3>
          <button 
            onClick={() => setCurrentView('tasks')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            すべて表示 →
          </button>
        </div>

        {urgentTasks.length === 0 ? (
          <p className={textSecondary}>緊急のタスクはありません 🎉</p>
        ) : (
          <div className="space-y-3">
            {urgentTasks.slice(0, 5).map(task => (
              <TaskItem 
                key={task.id}
                task={task}
                toggleTask={toggleTask}
                calculatePriority={calculatePriority}
                getPriorityColor={getPriorityColor}
                getPriorityLabel={getPriorityLabel}
                darkMode={darkMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active Projects */}
      <div className={`${cardBg} rounded-xl p-6 shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">進行中のプロジェクト</h3>
          <button 
            onClick={() => setCurrentView('projects')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            すべて表示 →
          </button>
        </div>

        {projects.length === 0 ? (
          <p className={textSecondary}>プロジェクトを作成してください</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.slice(0, 4).map(project => (
              <ProjectCard 
                key={project.id}
                project={project}
                darkMode={darkMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Stat Card Component
// ============================================
function StatCard({ title, value, icon, color, darkMode }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform`}>
      <div className="flex items-center justify-between mb-4">
        <div className="bg-white bg-opacity-20 p-3 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm opacity-90">{title}</div>
    </div>
  );
}

// ============================================
// Task Item Component
// ============================================
function TaskItem({ task, toggleTask, calculatePriority, getPriorityColor, getPriorityLabel, darkMode }) {
  const priority = calculatePriority(task);
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`flex items-start gap-3 p-4 border ${borderColor} rounded-lg hover:shadow-md transition-shadow`}>
      <input 
        type="checkbox"
        checked={task.completed}
        onChange={() => toggleTask(task.id)}
        className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(priority)} text-white font-medium`}>
            {getPriorityLabel(priority)}
          </span>
          {task.dueDate && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(task.dueDate).toLocaleDateString('ja-JP')}
            </span>
          )}
        </div>
        <p className={`font-medium ${task.completed ? 'line-through opacity-50' : ''}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-sm text-gray-500 mt-1">{task.description}</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Project Card Component
// ============================================
function ProjectCard({ project, darkMode }) {
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`p-4 border ${borderColor} rounded-lg hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold">{project.name}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${
          project.priority === 'high' ? 'bg-red-100 text-red-700' :
          project.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
          'bg-green-100 text-green-700'
        }`}>
          {project.priority === 'high' ? '高' : project.priority === 'medium' ? '中' : '低'}
        </span>
      </div>
      {project.description && (
        <p className={`text-sm ${textSecondary} mb-3 line-clamp-2`}>{project.description}</p>
      )}
      <div className="mb-2">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className={textSecondary}>進捗</span>
          <span className="font-medium">{project.progress || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${project.progress || 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Tasks View
// ============================================
function TasksView({ tasks, projects, addTask, toggleTask, updateTask, deleteTask, calculatePriority, getPriorityColor, getPriorityLabel, darkMode, showNewTaskModal, setShowNewTaskModal }) {
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState(null);

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || task.projectId === filterProject;
    const priority = calculatePriority(task);
    const matchesPriority = filterPriority === 'all' || priority === filterPriority;
    
    return matchesSearch && matchesProject && matchesPriority;
  });

  const incompleteTasks = filteredTasks.filter(t => !t.completed);
  const completedTasks = filteredTasks.filter(t => t.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">タスク管理</h2>
        <button 
          onClick={() => setShowNewTaskModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          新規タスク
        </button>
      </div>

      {/* Filters */}
      <div className={`${cardBg} rounded-xl p-4 shadow-lg`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <select 
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">すべての優先度</option>
            <option value="overdue">期限超過</option>
            <option value="urgent">緊急</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>

          <select 
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">すべてのプロジェクト</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task Lists */}
      <div className="space-y-6">
        {/* Incomplete Tasks */}
        <div className={`${cardBg} rounded-xl p-6 shadow-lg`}>
          <h3 className="text-xl font-bold mb-4">未完了タスク ({incompleteTasks.length})</h3>
          {incompleteTasks.length === 0 ? (
            <p className={textSecondary}>すべてのタスクが完了しています 🎉</p>
          ) : (
            <div className="space-y-3">
              {incompleteTasks.map(task => (
                <DetailedTaskItem 
                  key={task.id}
                  task={task}
                  projects={projects}
                  toggleTask={toggleTask}
                  updateTask={updateTask}
                  deleteTask={deleteTask}
                  calculatePriority={calculatePriority}
                  getPriorityColor={getPriorityColor}
                  getPriorityLabel={getPriorityLabel}
                  darkMode={darkMode}
                  setEditingTask={setEditingTask}
                />
              ))}
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className={`${cardBg} rounded-xl p-6 shadow-lg`}>
            <h3 className="text-xl font-bold mb-4">完了済み ({completedTasks.length})</h3>
            <div className="space-y-3">
              {completedTasks.map(task => (
                <DetailedTaskItem 
                  key={task.id}
                  task={task}
                  projects={projects}
                  toggleTask={toggleTask}
                  updateTask={updateTask}
                  deleteTask={deleteTask}
                  calculatePriority={calculatePriority}
                  getPriorityColor={getPriorityColor}
                  getPriorityLabel={getPriorityLabel}
                  darkMode={darkMode}
                  setEditingTask={setEditingTask}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showNewTaskModal && (
        <TaskModal 
          onClose={() => setShowNewTaskModal(false)}
          onSave={addTask}
          projects={projects}
          darkMode={darkMode}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskModal 
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(updates) => {
            updateTask(editingTask.id, updates);
            setEditingTask(null);
          }}
          projects={projects}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

// ============================================
// Detailed Task Item Component
// ============================================
function DetailedTaskItem({ task, projects, toggleTask, updateTask, deleteTask, calculatePriority, getPriorityColor, getPriorityLabel, darkMode, setEditingTask }) {
  const [showMenu, setShowMenu] = useState(false);
  const priority = calculatePriority(task);
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  
  const project = projects.find(p => p.id === task.projectId);

  return (
    <div className={`flex items-start gap-3 p-4 border ${borderColor} rounded-lg hover:shadow-md transition-shadow relative`}>
      <input 
        type="checkbox"
        checked={task.completed}
        onChange={() => toggleTask(task.id)}
        className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(priority)} text-white font-medium`}>
            {getPriorityLabel(priority)}
          </span>
          {task.dueDate && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(task.dueDate).toLocaleDateString('ja-JP')}
            </span>
          )}
          {project && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {project.name}
            </span>
          )}
        </div>
        
        <p className={`font-medium mb-1 ${task.completed ? 'line-through opacity-50' : ''}`}>
          {task.title}
        </p>
        
        {task.description && (
          <p className="text-sm text-gray-500">{task.description}</p>
        )}
      </div>

      <div className="relative">
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10">
            <button 
              onClick={() => {
                setEditingTask(task);
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <Edit2 className="w-4 h-4" />
              編集
            </button>
            <button 
              onClick={() => {
                if (confirm('このタスクを削除しますか？')) {
                  deleteTask(task.id);
                }
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900 text-red-600 transition-colors text-left"
            >
              <Trash2 className="w-4 h-4" />
              削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Task Modal Component
// ============================================
function TaskModal({ task, onClose, onSave, projects, darkMode }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [projectId, setProjectId] = useState(task?.projectId || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title,
      description,
      dueDate,
      projectId
    });

    onClose();
  };

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${cardBg} rounded-xl p-6 max-w-md w-full`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{task ? 'タスクを編集' : '新規タスク'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">タイトル *</label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスク名を入力"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">説明</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細を入力（任意）"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">期限</label>
            <input 
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">プロジェクト</label>
            <select 
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">なし</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              キャンセル
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {task ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Projects View
// ============================================
function ProjectsView({ projects, tasks, addProject, updateProject, deleteProject, darkMode, showNewProjectModal, setShowNewProjectModal, setCurrentView }) {
  const [editingProject, setEditingProject] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null);

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

  const getProjectTasks = (projectId) => {
    return tasks.filter(t => t.projectId === projectId);
  };

  const calculateProjectProgress = (projectId) => {
    const projectTasks = getProjectTasks(projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter(t => t.completed).length;
    return Math.round((completed / projectTasks.length) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">プロジェクト管理</h2>
        <button 
          onClick={() => setShowNewProjectModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          新規プロジェクト
        </button>
      </div>

      {projects.length === 0 ? (
        <div className={`${cardBg} rounded-xl p-12 text-center shadow-lg`}>
          <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className={textSecondary}>プロジェクトを作成して始めましょう</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {projects.map(project => {
            const projectTasks = getProjectTasks(project.id);
            const progress = calculateProjectProgress(project.id);
            const isExpanded = expandedProject === project.id;

            return (
              <div key={project.id} className={`${cardBg} rounded-xl p-6 shadow-lg`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{project.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        project.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
                        project.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {project.priority === 'high' ? '高' : project.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    {project.description && (
                      <p className={`${textSecondary} text-sm`}>{project.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setEditingProject(project)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('このプロジェクトを削除しますか？関連するタスクもすべて削除されます。')) {
                          deleteProject(project.id);
                        }
                      }}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className={textSecondary}>進捗状況</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className={textSecondary}>
                    タスク: {projectTasks.filter(t => t.completed).length}/{projectTasks.length}
                  </span>
                  {project.deadline && (
                    <span className={textSecondary}>
                      期限: {new Date(project.deadline).toLocaleDateString('ja-JP')}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold mb-3">プロジェクトのタスク</h4>
                    {projectTasks.length === 0 ? (
                      <p className={textSecondary}>タスクがありません</p>
                    ) : (
                      <div className="space-y-2">
                        {projectTasks.map(task => (
                          <div key={task.id} className="flex items-center gap-2 text-sm">
                            <input 
                              type="checkbox"
                              checked={task.completed}
                              readOnly
                              className="w-4 h-4"
                            />
                            <span className={task.completed ? 'line-through opacity-50' : ''}>
                              {task.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <ProjectModal 
          onClose={() => setShowNewProjectModal(false)}
          onSave={addProject}
          darkMode={darkMode}
        />
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <ProjectModal 
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={(updates) => {
            updateProject(editingProject.id, updates);
            setEditingProject(null);
          }}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

// ============================================
// Project Modal Component
// ============================================
function ProjectModal({ project, onClose, onSave, darkMode }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [priority, setPriority] = useState(project?.priority || 'medium');
  const [deadline, setDeadline] = useState(project?.deadline || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name,
      description,
      priority,
      deadline
    });

    onClose();
  };

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${cardBg} rounded-xl p-6 max-w-md w-full`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{project ? 'プロジェクトを編集' : '新規プロジェクト'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">プロジェクト名 *</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="プロジェクト名を入力"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">説明</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="プロジェクトの説明（任意）"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">優先度</label>
            <select 
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">期限</label>
            <input 
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              キャンセル
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {project ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Calendar View
// ============================================
function CalendarView({ events, tasks, darkMode, isLoadingCalendar, calendarError, onSyncCalendar, onRefreshCalendar }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month, week, day

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

  const hasGoogleAuth = !!localStorage.getItem('google_access_token');
  
  // Debug log
  console.log('CalendarView Debug:', {
    hasGoogleAuth,
    onSyncCalendar: typeof onSyncCalendar,
    accessToken: localStorage.getItem('google_access_token')
  });

  // Simple month view for now
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Previous month days
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  const getTasksForDate = (date) => {
    if (!date) return [];
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">カレンダー</h2>
        <div className="flex items-center gap-3">
          {!hasGoogleAuth ? (
            <button 
              onClick={() => {
                console.log('連携ボタンがクリックされました');
                console.log('onSyncCalendar:', onSyncCalendar);
                if (onSyncCalendar) {
                  onSyncCalendar();
                } else {
                  alert('onSyncCalendar関数が定義されていません');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              type="button"
            >
              <Calendar className="w-4 h-4" />
              Googleカレンダーと連携
            </button>
          ) : (
            <button 
              onClick={onRefreshCalendar}
              disabled={isLoadingCalendar}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isLoadingCalendar ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  同期中...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  カレンダーを更新
                </>
              )}
            </button>
          )}
          <button 
            onClick={goToToday}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            今日
          </button>
          <button 
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            ←
          </button>
          <span className="text-lg font-semibold min-w-[150px] text-center">
            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
          </span>
          <button 
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar Status */}
      {calendarError && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">{calendarError}</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Googleカレンダーと連携すると、予定を自動で表示できます
            </p>
          </div>
        </div>
      )}

      {hasGoogleAuth && events.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-sm text-green-700 dark:text-green-300">
            Googleカレンダーと連携中 • {events.length}件のイベントを表示
          </p>
        </div>
      )}

      <div className={`${cardBg} rounded-xl p-6 shadow-lg`}>
        {/* Week days header */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {weekDays.map(day => (
            <div key={day} className={`text-center font-semibold py-2 ${textSecondary}`}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            const dayTasks = day ? getTasksForDate(day) : [];
            const dayEvents = day ? getEventsForDate(day) : [];
            const isToday = day && day.toDateString() === new Date().toDateString();
            const isCurrentMonth = day && day.getMonth() === currentDate.getMonth();

            return (
              <div 
                key={index}
                className={`min-h-[100px] p-2 border rounded-lg ${
                  isToday ? 'border-pink-600 bg-pink-50 dark:bg-pink-900/20' : 
                  isCurrentMonth ? 'border-gray-200 dark:border-gray-700' : 
                  'border-gray-100 dark:border-gray-800 opacity-50'
                }`}
              >
                {day && (
                  <>
                    <div className={`text-sm font-medium mb-2 ${
                      isToday ? 'text-pink-600' : isCurrentMonth ? '' : textSecondary
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {/* Google Calendar Events */}
                      {dayEvents.slice(0, 2).map(event => (
                        <div 
                          key={event.id}
                          className="text-xs p-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded truncate flex items-center gap-1"
                          title={event.title}
                        >
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{event.title}</span>
                        </div>
                      ))}
                      {/* Tasks */}
                      {dayTasks.slice(0, 2).map(task => (
                        <div 
                          key={task.id}
                          className="text-xs p-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded truncate"
                          title={task.title}
                        >
                          {task.title}
                        </div>
                      ))}
                      {(dayTasks.length + dayEvents.length) > 2 && (
                        <div className="text-xs text-gray-500">
                          +{(dayTasks.length + dayEvents.length) - 2}件
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming tasks and events */}
      <div className={`${cardBg} rounded-xl p-6 shadow-lg`}>
        <h3 className="text-xl font-bold mb-4">今後の予定</h3>
        <div className="space-y-3">
          {/* Google Calendar Events */}
          {events
            .filter(e => new Date(e.start) >= new Date())
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .slice(0, 5)
            .map(event => (
              <div key={event.id} className="flex items-start gap-3 p-3 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/10">
                <Calendar className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(event.start).toLocaleDateString('ja-JP', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: event.allDay ? undefined : '2-digit',
                      minute: event.allDay ? undefined : '2-digit'
                    })}
                  </p>
                  {event.location && (
                    <p className="text-xs text-gray-500 mt-1">📍 {event.location}</p>
                  )}
                </div>
              </div>
            ))}
          
          {/* Tasks */}
          {tasks
            .filter(t => t.dueDate && !t.completed && new Date(t.dueDate) >= new Date())
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 5)
            .map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(task.dueDate).toLocaleDateString('ja-JP', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            
          {tasks.filter(t => t.dueDate && !t.completed && new Date(t.dueDate) >= new Date()).length === 0 && 
           events.filter(e => new Date(e.start) >= new Date()).length === 0 && (
            <p className={textSecondary}>予定はありません</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Chat View
// ============================================
function ChatView({ messages, inputMessage, setInputMessage, sendMessage, isLoading, darkMode, chatEndRef }) {
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-170px)]">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
          💕 一緒にお話ししよう
        </h2>
        <p className={textSecondary}>何でも相談してね</p>
      </div>

      {/* Messages */}
      <div className={`flex-1 ${cardBg} rounded-xl p-6 shadow-lg overflow-y-auto mb-4`}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-pink-400" />
              <p className={textSecondary}>ねえねえ、何か話そう？</p>
              <p className="text-sm text-gray-400 mt-2">
                疲れてない？困ってることがあったら何でも言ってね 💕
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(message => (
              <div 
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className={`${cardBg} rounded-xl p-4 shadow-lg border-2 border-pink-100 dark:border-pink-900`}>
        <div className="flex gap-3">
          <textarea 
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="何でも話してね...💬"
            rows={1}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-pink-500 outline-none resize-none"
          />
          <button 
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
export default PersonalAssistantApp;
