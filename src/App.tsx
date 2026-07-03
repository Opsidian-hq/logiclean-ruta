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
  IonMenu,
  IonMenuToggle,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Switch, Redirect } from 'react-router-dom';
import {
  gridOutline,
  peopleOutline,
  cubeOutline,
  mapOutline,
  walletOutline,
  homeOutline,
  businessOutline,
  cashOutline,
  personOutline,
  menuOutline,
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

/* Páginas — Login eager (entrada); el resto en chunks diferidos por ruta */
import { LoginPage } from './pages/Login';
import { lazyPage } from './components/lazyPage';

const CatalogoOfflinePage = lazyPage(() => import('./pages/CatalogoOffline'), 'CatalogoOfflinePage');
const VisitasPage = lazyPage(() => import('./pages/visitas/VisitasPage'), 'VisitasPage');
const InventarioPage = lazyPage(() => import('./pages/venta/InventarioPage'), 'InventarioPage');
const VentaPage = lazyPage(() => import('./pages/venta/VentaPage'), 'VentaPage');
const CobrarSaldoPage = lazyPage(() => import('./pages/cobranza/CobrarSaldoPage'), 'CobrarSaldoPage');
const CobroFlowPage = lazyPage(() => import('./pages/cobranza/CobroFlowPage'), 'CobroFlowPage');
const CobrosPendientesPage = lazyPage(() => import('./pages/cobranza/CobrosPendientesPage'), 'CobrosPendientesPage');
const EntregaPage = lazyPage(() => import('./pages/visitas/EntregaPage'), 'EntregaPage');
const SeguimientoPage = lazyPage(() => import('./pages/visitas/SeguimientoPage'), 'SeguimientoPage');
const GastosPage = lazyPage(() => import('./pages/gastos/GastosPage'), 'GastosPage');
const CatalogoPage = lazyPage(() => import('./pages/admin/CatalogoPage'), 'CatalogoPage');
const ClientesPage = lazyPage(() => import('./pages/admin/ClientesPage'), 'ClientesPage');
const DashboardPage = lazyPage(() => import('./pages/admin/DashboardPage'), 'DashboardPage');
const CortePage = lazyPage(() => import('./pages/admin/CortePage'), 'CortePage');
const RegistrosNegocioPage = lazyPage(() => import('./pages/admin/RegistrosNegocioPage'), 'RegistrosNegocioPage');
const EnvasadoPage = lazyPage(() => import('./pages/admin/EnvasadoPage'), 'EnvasadoPage');
const CargaDevolucionPage = lazyPage(() => import('./pages/CargaDevolucionPage'), 'CargaDevolucionPage');
const MisClientesPage = lazyPage(() => import('./pages/clientes/MisClientesPage'), 'MisClientesPage');
const ClienteDetallePage = lazyPage(() => import('./pages/clientes/ClienteDetallePage'), 'ClienteDetallePage');

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

              {/* Rutas vendedor: shell con tabs */}
              <Route path={['/visitas', '/catalogo', '/inventario', '/venta', '/gastos', '/cobranza', '/cobro', '/cobros', '/entrega', '/seguimiento', '/mis-clientes', '/clientes']}>
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

const MENU_ITEMS = [
  { path: '/cobros',       icon: cashOutline,   label: 'Cobros'   },
  { path: '/mis-clientes', icon: personOutline, label: 'Clientes' },
  { path: '/catalogo',     icon: gridOutline,   label: 'Catálogo' },
] as const;

function VendedorTabs() {
  return (
    <>
      <IonMenu contentId="vendedor-content" menuId="vendedor-menu" side="end">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Más opciones</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList lines="none">
            {MENU_ITEMS.map(({ path, icon, label }) => (
              <IonMenuToggle key={path} menu="vendedor-menu" autoHide={false}>
                <IonItem
                  routerLink={path}
                  routerDirection="none"
                  style={{ '--min-height': 'var(--touch-min)' }}
                >
                  <IonIcon icon={icon} slot="start" color="primary" />
                  <IonLabel>{label}</IonLabel>
                </IonItem>
              </IonMenuToggle>
            ))}
          </IonList>
        </IonContent>
      </IonMenu>

      <IonTabs>
        <IonRouterOutlet id="vendedor-content">
          <Route exact path="/visitas" component={VisitasPage} />
          <Route exact path="/catalogo" component={CatalogoOfflinePage} />
          <Route exact path="/inventario" component={InventarioPage} />
          <Route exact path="/inventario/carga-devolucion" component={CargaDevolucionPage} />
          <Route exact path="/venta" component={VentaPage} />
          <Route exact path="/cobros" component={CobrosPendientesPage} />
          <Route exact path="/cobranza/:clienteId" component={CobrarSaldoPage} />
          <Route exact path="/cobro/:clienteId" component={CobroFlowPage} />
          <Route exact path="/entrega/:clienteId" component={EntregaPage} />
          <Route exact path="/seguimiento/:clienteId" component={SeguimientoPage} />
          <Route exact path="/gastos" component={GastosPage} />
          <Route exact path="/mis-clientes" component={MisClientesPage} />
          <Route exact path="/clientes/:clienteId" component={ClienteDetallePage} />
        </IonRouterOutlet>

        <IonTabBar slot="bottom" style={{ '--background': 'var(--color-navy)' }}>
          <IonTabButton tab="visitas" href="/visitas">
            <IonIcon icon={mapOutline} style={{ color: 'var(--color-on-dark)' }} />
            <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Visitas</span>
          </IonTabButton>
<IonTabButton tab="gastos" href="/gastos">
            <IonIcon icon={walletOutline} style={{ color: 'var(--color-on-dark)' }} />
            <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Gastos</span>
          </IonTabButton>
          <IonTabButton tab="inventario" href="/inventario">
            <IonIcon icon={cubeOutline} style={{ color: 'var(--color-on-dark)' }} />
            <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Inventario</span>
          </IonTabButton>
          <IonTabButton tab="more">
            <IonMenuToggle menu="vendedor-menu" autoHide={false}>
              <IonIcon icon={menuOutline} style={{ color: 'var(--color-on-dark)' }} />
              <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Más</span>
            </IonMenuToggle>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </>
  );
}

// ── Tabs del panel de administración ─────────────────────────

function AdminTabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/admin">
          <Redirect to="/admin/dashboard" />
        </Route>
        <Route exact path="/admin/dashboard" component={DashboardPage} />
        <Route exact path="/admin/catalogo" component={CatalogoPage} />
        <Route exact path="/admin/clientes" component={ClientesPage} />
        <Route exact path="/admin/clientes/:clienteId" component={ClienteDetallePage} />
        <Route exact path="/admin/corte" component={CortePage} />
        <Route exact path="/admin/negocio" component={RegistrosNegocioPage} />
        <Route exact path="/admin/envasado" component={EnvasadoPage} />
        <Route exact path="/admin/carga-devolucion" component={CargaDevolucionPage} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" style={{ '--background': 'var(--color-navy)' }}>
        <IonTabButton tab="dashboard" href="/admin/dashboard">
          <IonIcon icon={homeOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Inicio</span>
        </IonTabButton>
        <IonTabButton tab="catalogo" href="/admin/catalogo">
          <IonIcon icon={gridOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Catálogo</span>
        </IonTabButton>
        <IonTabButton tab="clientes" href="/admin/clientes">
          <IonIcon icon={peopleOutline} style={{ color: 'var(--color-on-dark)' }} />
          <span style={{ color: 'var(--color-on-dark)', fontSize: 'var(--font-size-2xs)' }}>Clientes</span>
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
