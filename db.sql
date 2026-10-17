CREATE DATABASE IF NOT EXISTS controle_pedidos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE controle_pedidos;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('admin','operador') NOT NULL DEFAULT 'operador',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  tel VARCHAR(25) NOT NULL,
  endereco VARCHAR(500) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cliente_nome (nome),
  INDEX idx_cliente_tel (tel)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produtos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  sku VARCHAR(60) NOT NULL UNIQUE,
  preco DECIMAL(12,2) NOT NULL,
  estoque INT UNSIGNED NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_preco CHECK (preco > 0),
  INDEX idx_produto_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pedidos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT UNSIGNED NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  status ENUM('pendente','preparo','enviado','entregue','cancelado') NOT NULL DEFAULT 'pendente',
  cliente_nome VARCHAR(120) NOT NULL,
  cliente_tel VARCHAR(25) NOT NULL,
  cliente_endereco VARCHAR(500) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  INDEX idx_pedido_data (criado_em),
  INDEX idx_pedido_status_data (status, criado_em)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pedidos_itens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT UNSIGNED NOT NULL,
  produto_id INT UNSIGNED NOT NULL,
  nome VARCHAR(160) NOT NULL,
  sku VARCHAR(60) NOT NULL,
  qtd INT UNSIGNED NOT NULL,
  preco DECIMAL(12,2) NOT NULL,
  CONSTRAINT chk_qtd CHECK (qtd > 0),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id),
  UNIQUE KEY idx_item_produto (pedido_id, produto_id)
) ENGINE=InnoDB;
