/**
 * Logiclean Ruta — App.tsx
 *
 * Raíz de la aplicación.
 * Configura: IonApp, IonReactRouter, contextos globales y rutas.
 *
 * Rutas:
 *   /login               → LoginPage (pública)
 *   /catalogo            → CatalogoOfflinePage (vendedor, protegida)
 *   /admin               → redirect a /admin/catalogo
 *   /admin/catalogo      → CatalogoPage (gerente, protegida)
 *   /admin/clientes      → ClientesPage (gerente, protegida)
 *   /                    → redirect según rol
 */

import {
  IonApp,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Switch, Redirect } from 'react-router-dom';
import { gridOutline, peopleOutline } from 'ionicons/icons';

/* Ionic Core CSS — DEBE importarse antes de cualquier componente Ionic */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Tokens de diseño Logiclean */
import './theme/variables.css';

/* Contextos */
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';

/* Páginas */
import { LoginPage } from './pages/Login';
import { CatalogoOfflinePage } from './pages/CatalogoOffline';
import { CatalogoPage } from './pages/admin/CatalogoPage';
import { ClientesPage } from './pages/admin/ClientesPage';

/* Guards */
import { ProtectedRoute } from './components/ProtectedRoute';

/* Inicializar Ionic (modo MD para consistencia cross-platform) */
setupIonicReact({
  mode: 'md',
});

// ── Componente raíz ───────────────────────────────────────────

function App() {
  return (
    <IonApp>
      <AuthProvider>
        <SyncProvider>
          <IonReactRouter>
            <Switch>
              {/* Ruta pública */}
              <Route exact path="/login" component={LoginPage} />

              {/* Ruta vendedor: catálogo offline */}
              <Route exact path="/catalogo">
                <ProtectedRoute requiredRol="vendedor">
                  <CatalogoOfflinePage />
                </ProtectedRoute>
              </Route>

              {/* Rutas gerente: panel admin con tabs */}
              <Route path="/admin">
                <ProtectedRoute requiredRol="gerente">
                  <AdminTabs />
                </ProtectedRoute>
              </Route>

              {/* Raíz: redirigir a login */}
              <Route exact path="/">
                <Redirect to="/login" />
              </Route>

              {/* 404 → login */}
              <Route>
                <Redirect to="/login" />
              </Route>
            </Switch>
          </IonReactRouter>
        </SyncProvider>
      </AuthProvider>
    </IonApp>
  );
}

// ── Tabs del panel de administración ─────────────────────────

function AdminTabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/admin">
          <Redirect to="/admin/catalogo" />
        </Route>
        <Route exact path="/admin/catalogo" component={CatalogoPage} />
        <Route exact path="/admin/clientes" component={ClientesPage} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" style={{ '--background': 'var(--color-navy)' }}>
        <IonTabButton tab="catalogo" href="/admin/catalogo">
          <IonIcon icon={gridOutline} style={{ color: '#fff' }} />
          <span style={{ color: '#fff', fontSize: '11px' }}>Catálogo</span>
        </IonTabButton>
        <IonTabButton tab="clientes" href="/admin/clientes">
          <IonIcon icon={peopleOutline} style={{ color: '#fff' }} />
          <span style={{ color: '#fff', fontSize: '11px' }}>Clientes</span>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

export default App;
