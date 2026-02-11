import React, { createContext, useContext, useState, useCallback } from 'react';
import { CustomAlert, AlertButton } from '../components/CustomAlert';

interface AlertState {
    visible: boolean;
    title: string;
    message: string;
    buttons: AlertButton[];
    isPrompt: boolean;
    inputPlaceholder: string;
    secureTextEntry: boolean;
}

interface AlertContextType {
    showAlert: (
        title: string,
        message?: string,
        buttons?: AlertButton[]
    ) => void;
    showPrompt: (
        title: string,
        message?: string,
        buttons?: AlertButton[],
        secureTextEntry?: boolean,
        inputPlaceholder?: string
    ) => void;
}

const AlertContext = createContext<AlertContextType>({
    showAlert: () => { },
    showPrompt: () => { },
});

export const useAlert = () => useContext(AlertContext);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [alertState, setAlertState] = useState<AlertState>({
        visible: false,
        title: '',
        message: '',
        buttons: [{ text: 'OK' }],
        isPrompt: false,
        inputPlaceholder: '',
        secureTextEntry: true,
    });

    const showAlert = useCallback((
        title: string,
        message?: string,
        buttons?: AlertButton[]
    ) => {
        setAlertState({
            visible: true,
            title: title || '',
            message: message || '',
            buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
            isPrompt: false,
            inputPlaceholder: '',
            secureTextEntry: true,
        });
    }, []);

    const showPrompt = useCallback((
        title: string,
        message?: string,
        buttons?: AlertButton[],
        secureTextEntry: boolean = true,
        inputPlaceholder: string = ''
    ) => {
        setAlertState({
            visible: true,
            title: title || '',
            message: message || '',
            buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
            isPrompt: true,
            inputPlaceholder,
            secureTextEntry,
        });
    }, []);

    const handleDismiss = useCallback(() => {
        setAlertState(prev => ({ ...prev, visible: false }));
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, showPrompt }}>
            {children}
            <CustomAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onDismiss={handleDismiss}
                isPrompt={alertState.isPrompt}
                inputPlaceholder={alertState.inputPlaceholder}
                secureTextEntry={alertState.secureTextEntry}
            />
        </AlertContext.Provider>
    );
};

export default AlertProvider;
