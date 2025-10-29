from .UsuarioViews import RegistroView, LoginView
from .AlimentoTacoViews import AlimentoTacoView
from .GoogleAuthViews import google_auth
from .ReceitaViews import ReceitaCreateView, ReceitaUpdateView, ReceitaDeleteView, ReceitaListView
from .IngredienteViews import IngredienteCreateView, IngredienteUpdateView, IngredienteDeleteView, IngredienteListByReceitaView, IngredienteDetailView
from .RotuloNutricionalViews import RotuloNutricionalView
from .DocumentoViews import DocumentoCreateView, DocumentoListView, DocumentoPdfView, RotuloPdfView
from .ClienteViews import ClienteListView, ClienteCreateView, ClienteDetailView, ClienteDeleteView, ClienteUpdateView
from .ChangePasswordViews import ChangePasswordView