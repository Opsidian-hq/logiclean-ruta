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
import {
  gridOutline,
  peopleOutline,
  cubeOutline,
  cartOutline,
  mapOutline,
  walletOutline,
  funnelOutline,
  receiptOutline,
  businessOutline,
} from 'ionicons/icons';

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
import { VisitasPage } from './pages/visitas/VisitasPage';
import { InventarioPage } from './pages/venta/InventarioPage';
import { VentaPage } from './pages/venta/VentaPage';
import { GastosPage } from './pages/gastos/GastosPage';
import { CatalogoPage } from './pages/admin/CatalogoPage';
import { ClientesPage } from './pages/admin/ClientesPage';
import { ProspectosPanelPage } from './pages/admin/ProspectosPanelPage';
import { CortePage } from './pages/admin/CortePage';
import { RegistrosNegocioPage } from './pages/admin/RegistrosNegocioPage';

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

              {/* Rutas vendedor: shell con tabs (visitas, venta, inventario, gastos, catálogo) */}
              <Route path={['/visitas', '/catalogo', '/inventario', '/venta', '/gastos']}>
                <ProtectedRoute requiredRol="vendedor">
                  <VendedorTabs />
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

// ── Tabs del vendedor ─────────────────────────────────────────

function VendedorTabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/visitas" component={VisitasPage} />
        <Route exact path="/catalogo" component={CatalogoOfflinePage} />
        <Route exact path="/inventario" component={InventarioPage} />
        <Route exact path="/venta" component={VentaPage} />
        <Route exact path="/gastos" component={GastosPage} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" style={{ '--background': 'var(--color-navy)' }}>
        <IonTabButton tab="visitas" href="/visitas">
          <IonIcon icon={mapOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Visitas</span>
        </IonTabButton>
        <IonTabButton tab="venta" href="/venta">
          <IonIcon icon={cartOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Venta</span>
        </IonTabButton>
        <IonTabButton tab="inventario" href="/inventario">
          <IonIcon icon={cubeOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Inventario</span>
        </IonTabButton>
        <IonTabButton tab="gastos" href="/gastos">
          <IonIcon icon={walletOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Gastos</span>
        </IonTabButton>
        <IonTabButton tab="catalogo" href="/catalogo">
          <IonIcon icon={gridOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Catálogo</span>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
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
        <Route exact path="/admin/prospectos" component={ProspectosPanelPage} />
        <Route exact path="/admin/corte" component={CortePage} />
        <Route exact path="/admin/negocio" component={RegistrosNegocioPage} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" style={{ '--background': 'var(--color-navy)' }}>
        <IonTabButton tab="prospectos" href="/admin/prospectos">
          <IonIcon icon={funnelOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Prospectos</span>
        </IonTabButton>
        <IonTabButton tab="catalogo" href="/admin/catalogo">
          <IonIcon icon={gridOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Catálogo</span>
        </IonTabButton>
        <IonTabButton tab="clientes" href="/admin/clientes">
          <IonIcon icon={peopleOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Clientes</span>
        </IonTabButton>
        <IonTabButton tab="corte" href="/admin/corte">
          <IonIcon icon={receiptOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Corte</span>
        </IonTabButton>
        <IonTabButton tab="negocio" href="/admin/negocio">
          <IonIcon icon={businessOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Negocio</span>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

export default App;
