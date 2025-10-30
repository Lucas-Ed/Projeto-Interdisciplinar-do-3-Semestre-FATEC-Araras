// contexts/AuthContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useRef } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext();

// Tipos de ações
const ACTION_TYPES = {
  SET_LOADING: "SET_LOADING",
  SET_USER: "SET_USER",
  SET_ERROR: "SET_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR",
  LOGOUT: "LOGOUT",
  SET_ACTIVITY: "SET_ACTIVITY",
};

// Estado inicial
const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  lastActivity: Date.now(),
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.SET_LOADING:
      return { ...state, loading: action.payload };

    case ACTION_TYPES.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
        error: null,
        lastActivity: Date.now(),
      };

    case ACTION_TYPES.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false,
        isAuthenticated: false,
        user: null,
      };

    case ACTION_TYPES.CLEAR_ERROR:
      return { ...state, error: null };

    case ACTION_TYPES.LOGOUT:
      return {
        ...initialState,
        loading: false,
      };

    case ACTION_TYPES.SET_ACTIVITY:
      return {
        ...state,
        lastActivity: action.payload,
      };

    default:
      return state;
  }
};

// ⏰ TEMPOS REDUZIDOS PARA TESTES - OPÇÃO SEGURA
const REFRESH_INTERVAL = 25 * 1000; // 25 SEGUNDOS (teste) → produção: 13 * 60 * 1000 (13min)
const INACTIVITY_TIMEOUT = 60 * 1000; // 1 MINUTO (teste) → produção: 30 * 60 * 1000 (30min)

// Fila para evitar múltiplos refresh simultâneos
let isRefreshing = false;
let refreshQueue = [];

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Refs para controlar os intervalos
  const refreshIntervalRef = useRef(null);
  const inactivityTimeoutRef = useRef(null);
  const removeActivityListenersRef = useRef(null);

  // Verificar autenticação ao inicializar
  useEffect(() => {
    checkAuth();
    setupActivityListeners();
    
    return () => {
      cleanupIntervals();
      removeActivityListenersRef.current?.();
    };
  }, []);

  // Efeito para gerenciar auto-refresh quando autenticado
  useEffect(() => {
    if (state.isAuthenticated) {
      startAutoRefresh();
      startInactivityTimer();
    } else {
      cleanupIntervals();
    }
    
    return () => {
      cleanupIntervals();
    };
  }, [state.isAuthenticated]);

  // Efeito para reiniciar timer de inatividade quando houver atividade REAL do usuário
  useEffect(() => {
    if (state.isAuthenticated) {
      startInactivityTimer();
    }
  }, [state.lastActivity]);

  // Setup listeners para detectar atividade REAL do usuário
  const setupActivityListeners = () => {
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const updateActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - state.lastActivity;
      
      // Só atualiza se passou pelo menos 1 segundo da última atividade (performance)
      if (timeSinceLastActivity > 1000) {
        dispatch({ type: ACTION_TYPES.SET_ACTIVITY, payload: now });
      }
    };
    
    activities.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
    
    removeActivityListenersRef.current = () => {
      activities.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  };

  const cleanupIntervals = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  const startAutoRefresh = () => {
    cleanupIntervals();
    
    refreshIntervalRef.current = setInterval(async () => {
      try {
        // 🔒 OPÇÃO SEGURA: Auto-refresh NÃO atualiza a atividade do usuário
        // Isso garante que apenas atividades reais do usuário resetem o timer de inatividade
        await refreshToken();
      } catch (error) {
        // Erro silencioso no auto-refresh
        // O logout só acontecerá quando o usuário tentar fazer uma ação e o token estiver expirado
      }
    }, REFRESH_INTERVAL);
  };

  const startInactivityTimer = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    
    const now = Date.now();
    const timeSinceLastActivity = now - state.lastActivity;
    const timeUntilTimeout = INACTIVITY_TIMEOUT - timeSinceLastActivity;
    
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      handleAutoLogout();
    } else {
      inactivityTimeoutRef.current = setTimeout(() => {
        handleAutoLogout();
      }, timeUntilTimeout);
    }
  };

  const handleAutoLogout = async () => {
    cleanupIntervals();
    
    try {
      await authService.logout();
    } catch (error) {
      // Erro silencioso no logout automático
    } finally {
      dispatch({ type: ACTION_TYPES.LOGOUT });
    }
  };

  const checkAuth = async () => {
    try {
      dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true });

      const result = await authService.getUser();

      if (result.status === 200) {
        dispatch({ type: ACTION_TYPES.SET_USER, payload: result.data });
      } else {
        dispatch({ type: ACTION_TYPES.LOGOUT });
      }
    } catch (error) {
      dispatch({ type: ACTION_TYPES.LOGOUT });
    }
  };

  // Refresh token com fila para evitar múltiplas chamadas simultâneas
  const refreshToken = async () => {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
    }
    
    isRefreshing = true;
    
    try {
      const result = await authService.refreshToken();
      
      if (result.status === 200) {
        // 🔒 OPÇÃO SEGURA: NÃO atualiza a atividade do usuário ao renovar token
        // Apenas renova o token silenciosamente
        
        refreshQueue.forEach(({ resolve }) => resolve({ 
          success: true, 
          data: result.data 
        }));
        
        return { success: true, data: result.data };
      } else {
        throw new Error(result.data?.erro || 'Falha ao renovar token');
      }
    } catch (error) {
      refreshQueue.forEach(({ reject }) => reject(error));
      return { success: false, error: error.message };
    } finally {
      isRefreshing = false;
      refreshQueue = [];
    }
  };

  // Função para forçar atualização de atividade (apenas por ações REAIS do usuário)
  const updateActivity = () => {
    const now = Date.now();
    const timeSinceLastActivity = now - state.lastActivity;
    
    if (timeSinceLastActivity > 1000) {
      dispatch({ type: ACTION_TYPES.SET_ACTIVITY, payload: now });
    }
  };

  const login = async (credentials) => {
    try {
      dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true });
      dispatch({ type: ACTION_TYPES.CLEAR_ERROR });

      const result = await authService.login(credentials);

      if (result.status === 200) {
        await checkAuth();
        return { success: true, data: result.data };
      } else {
        dispatch({
          type: ACTION_TYPES.SET_ERROR,
          payload: result.data?.erro || "Erro ao fazer login",
        });
        return { success: false, error: result.data?.erro };
      }
    } catch (error) {
      dispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: error.message || "Erro ao fazer login",
      });
      return { success: false, error: error.message };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: ACTION_TYPES.SET_LOADING, payload: true });
      dispatch({ type: ACTION_TYPES.CLEAR_ERROR });

      const result = await authService.register(userData);

      if (result.status === 201) {
        await checkAuth();
        return { success: true, data: result.data };
      } else {
        dispatch({
          type: ACTION_TYPES.SET_ERROR,
          payload: result.data?.erro || "Erro ao criar conta",
        });
        return { success: false, error: result.data?.erro };
      }
    } catch (error) {
      dispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: error.message || "Erro ao criar conta",
      });
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    cleanupIntervals();
    
    try {
      const result = await authService.logout();
      if (result.status === 200) {
        return { success: true, data: result.data };
      } else {
        dispatch({
          type: ACTION_TYPES.SET_ERROR,
          payload: result.data?.erro || "Erro ao sair da conta",
        });
        return { success: false, error: result.data?.erro };
      }
    } catch (error) {
      // Logout silencioso mesmo em caso de erro
    } finally {
      dispatch({ type: ACTION_TYPES.LOGOUT });
    }
  };

  const clearError = () => {
    dispatch({ type: ACTION_TYPES.CLEAR_ERROR });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    clearError,
    checkAuth,
    refreshToken,
    updateActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};