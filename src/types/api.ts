// src/types/api.ts
export type Tecnico = {
  id_tecnico?: number;
  id?: number;
  nombre?: string;
  email?: string;
  rol?: string;
};

export type LoginResponse = {
  token: string;
  refreshToken?: string;
  user: Tecnico;
};

export type Cliente = {
  id_empresa: number;
  nombre: string;
  razonSocial?: string | null;
  correo?: string | null;
  direccion?: string | null;
  detalleEmpresa?: {
    rut?: string | null;
  } | null;
  origen?: string | null;
  telefono?: string | null;
  tieneSucursales?: boolean;
  dominios?: string[];
};

export type Equipo = {
  id_equipo: number;
  serial?: string;
  marca?: string;
  modelo?: string;
  disco?: string;
  procesador?: string;
  ram?: string;
  tipoDd?: string;
  tipo?: string;
  estado?: string;
  anioPc?: number | null;
  createdAt?: string;
  updatedAt?: string;
  propiedad?: string;
  propietarioExterno?: string | null;
  observaciones?: string | null;
  tieneAgente?: boolean;
  tieneMantencion?: boolean;
  tieneOneDrive?: boolean;
  macWifi?: string;
  redEthernet?: string;
  so?: string;
  estadoAlm?: string;
  office?: string;
  teamViewer?: string;
  claveTv?: string;
  revisado?: string;
  adminRidsUsuario?: string;
  adminRidsPassword?: string;
  usuarioEmpresa?: string;
  passwordEmpresa?: string;
  usuarioPersonal?: string;
  passwordPersonal?: string;
  adicionales?: EquipoAdicional[];
  empresaId?: number | null;
  idSolicitante?: number | null;
  nombreSolicitante?: string | null;
  solicitante?: Solicitante | null;
};

export type EquipoSoftwareInstalado = {
  id: number;
  nombre: string;
  version?: string | null;
  publisher?: string | null;
};

export type EquipoDetalle = Equipo & {
  creadoPor?: EquipoActor | null;
  creadoEn?: string | null;
  creacionAuditada?: boolean;

  ultimaEdicion?: string | null;
  ultimaEdicionPor?: EquipoActor | null;

  ultimaMantencion?: string | null;
  ultimaMantencionPor?: EquipoActor | null;

  diskFreeGb?: number | null;
  diskTotalGb?: number | null;

  antivirusNombre?: string | null;
  antivirusActivo?: boolean | null;
  firewallActivo?: boolean | null;
  bitlockerEstado?: string | null;
  windowsUpdate?: string | null;

  softwares?: EquipoSoftwareInstalado[];
};

export type EquipoAdicional = {
  id?: number;
  tipo: string;
  descripcion?: string | null;
  cantidad: number;
  serialAdicional?: string | null;
};

export type Solicitante = {
  id_solicitante: number;
  id?: number;
  nombre: string;
  email?: string | null;
  rut?: string | null;
  telefono?: string | null;
  empresaId?: number;
  clienteId?: number | null;
  sucursalId?: number | null;
};

export type Sucursal = {
  id_sucursal: number;
  id?: number;
  nombre: string;
  direccion?: string | null;
  empresaId?: number;
};

export type Coordenadas = {
  lat: number | null;
  lon: number | null;
};

export type ActividadesVisita = {
  impresoras?: boolean;
  telefonos?: boolean;
  pie?: boolean;
  otros?: boolean;
  ccleaner?: boolean;
  actualizaciones?: boolean;
  antivirus?: boolean;
  estadoDisco?: boolean;
  licenciaWindows?: boolean;
  licenciaOffice?: boolean;
  rendimientoEquipo?: boolean;
  mantenimientoReloj?: boolean;
  ecografo?: boolean;
};

export type CrearVisitaPayload = {
  empresaId: number;
  solicitante?: Solicitante[];
  sucursalId?: number | null;
  inicio?: string | Date;
  tecnicoId: number | string;
  direccion_visita?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  agendaId?: number | null;
};

export type CompletarVisitaPayload = {
  confImpresoras?: boolean;
  confTelefonos?: boolean;
  confPiePagina?: boolean;
  otros?: boolean;
  ccleaner?: boolean;
  actualizaciones?: boolean;
  antivirus?: boolean;
  estadoDisco?: boolean;
  licenciaWindows?: boolean;
  licenciaOffice?: boolean;
  rendimientoEquipo?: boolean;
  mantenimientoReloj?: boolean;
  ecografo?: boolean;
  otrosDetalle?: string;
  realizado?: string;
  solicitantes: Solicitante[];
  direccion_visita?: string | null;
  sucursalId?: number | null;
};

export type Visita = {
  id_visita: number;
  empresaId?: number;
  tecnicoId?: number;
  estado?: string;
  status?: string;
  inicio?: string;
  fin?: string | null;
  direccion_visita?: string | null;
  agendaId?: number | null;
  origen?: 'MANUAL' | 'AGENDA' | string | null;
  [key: string]: unknown;
};

export type HistorialVisita = {
  id?: number;
  id_historial?: number;
  empresaId?: number;
  tecnicoId?: number;
  solicitanteId?: number | null;
  solicitante?: string | null;
  inicio?: string;
  fin?: string;
  realizado?: string | null;
  direccion_visita?: string | null;
  empresa?: Pick<Cliente, 'id_empresa' | 'nombre'>;
  solicitanteRef?: Pick<Solicitante, 'id_solicitante' | 'nombre'>;
  sucursal?: Pick<Sucursal, 'id_sucursal' | 'nombre'> | null;
};

export type VisitaAsignada = {
  id: number;
  agendaId: number;
  empresa: (Pick<Cliente, 'id_empresa' | 'nombre' | 'razonSocial'> & {
    rut?: string | null;
  }) | null;
  sucursal: Pick<Sucursal, 'id_sucursal' | 'nombre' | 'direccion'> | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaProgramada: string;
  horaProgramada: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  estado: 'PROGRAMADA' | 'NOTIFICADA' | 'EN_RUTA' | 'INICIADA' | 'COMPLETADA' | 'CANCELADA' | string;
  observacion?: string | null;
  fechaInicioRuta?: string | null;
  fechaInicioVisita?: string | null;
  visitaId?: number | null;
  visitaStatus?: string | null;
  visitaOrigen?: 'MANUAL' | 'AGENDA' | string | null;
  inconsistenciaEstado?: 'VISITA_COMPLETADA_AGENDA_NO_COMPLETADA' | string | null;
};

export type RegistrarUbicacionPayload = {
  agendaId?: number | null;
  latitud: number;
  longitud: number;
  precision?: number | null;
  velocidad?: number | null;
  estadoTracking: string;
};

export type UbicacionTecnico = RegistrarUbicacionPayload & {
  id: number;
  tecnicoId: number;
  createdAt: string;
};

export type CrearEquipoPayload = Partial<Equipo> & {
  empresaId?: number;
  idSolicitante?: number;
  solicitanteId?: number | null;
  propiedad?: string;
  macWifi?: string;
  redEthernet?: string;
  so?: string;
  tipoDd?: string;
  estadoAlm?: string;
  office?: string;
  teamViewer?: string;
  claveTv?: string;
  revisado?: string;
  adminRidsUsuario?: string;
  adminRidsPassword?: string;
  usuarioEmpresa?: string;
  passwordEmpresa?: string;
  usuarioPersonal?: string;
  passwordPersonal?: string;
  adicionales?: EquipoAdicional[];
};

export type ActualizarEquipoPayload = Partial<
  Pick<
    Equipo,
    | 'serial'
    | 'marca'
    | 'modelo'
    | 'tipo'
    | 'estado'
    | 'anioPc'
    | 'procesador'
    | 'ram'
    | 'disco'
    | 'propiedad'
    | 'propietarioExterno'
    | 'observaciones'
    | 'macWifi'
    | 'redEthernet'
    | 'so'
    | 'tipoDd'
    | 'estadoAlm'
    | 'office'
    | 'teamViewer'
    | 'claveTv'
    | 'revisado'
    | 'adminRidsUsuario'
    | 'adminRidsPassword'
    | 'usuarioEmpresa'
    | 'passwordEmpresa'
    | 'usuarioPersonal'
    | 'passwordPersonal'
  >
> & { adicionales?: EquipoAdicional[] };

export type CrearUsuarioPayload = {
  nombre: string;
  empresaId: number;
  email?: string;
  telefono?: string;
  clienteId?: number | null;
};

export type EvidenciaTipo = 'foto' | 'firma' | 'pdf';

export type EvidenciaEntrega = {
  id: number;
  entregaId: number;
  tipo: string;
  url: string;
  publicId: string;
  formato?: string | null;
  bytes?: number | null;
  creadoEn?: string;
};

export type Entrega = {
  id_entrega: number;
  empresaNombre: string;
  receptorNombre: string;
  fecha: string;
  tecnicoId?: number;
  evidencias?: EvidenciaEntrega[];
  evidenciasCount?: number;
  _count?: {
    evidencias?: number;
  };
};

export type CrearEntregaPayload = {
  empresaNombre: string;
  receptorNombre: string;
  fecha?: string | Date;
  origen?: 'rids' | 'econnet';
  tipo?: 'entrega' | 'retiro';
};

export type UploadSignatureResponse = {
  apiKey?: string;
  cloudName?: string;
  folder?: string;
  publicId?: string;
  signature?: string;
  timestamp?: number;
  resourceType?: string;
  allowedFormats?: string[];
  maxBytes?: number;
  uploadUrl?: string;
  requiresUpload?: boolean;
  storage?: string;
  message?: string;
};

export type SolicitarFirmaPayload = {
  tipo: EvidenciaTipo;
  formato?: string | null;
  bytes?: number | null;
  nombreArchivo?: string | null;
};

export type ConfirmarEvidenciaPayload = {
  tipo: EvidenciaTipo;
  formato?: string;
  bytes?: number;
  url?: string;
  publicId?: string;
};

export type EnviarPdfEntregaPayload = {
  brand?: 'rids' | 'econnet';
  operation?: 'entrega' | 'retiro';
  pdfFile?: {
    mimeType: string;
    name: string;
    uri: string;
  };
  pdfBase64?: string;
  receptorEmail: string;
};

export type CrearClienteEconnetPayload = {
  nombre: string;
  rut?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  tipo?: 'EMPRESA' | 'PERSONA';
};

export type EquipoActor = {
  tipo: 'TECNICO' | 'SISTEMA';
  id_tecnico: number | null;
  nombre: string;
  email: string | null;
};