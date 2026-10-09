-- rice-dispatch schema (MySQL 8 / Aiven)
-- ทุกตารางต้องมี PRIMARY KEY (Aiven เปิด sql_require_primary_key)

CREATE TABLE customer (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  firstname  VARCHAR(100) NOT NULL,
  lastname   VARCHAR(100) NOT NULL,
  phone      VARCHAR(20)  NOT NULL UNIQUE,
  address    VARCHAR(255),
  lat        DECIMAL(9,6) NOT NULL,
  lng        DECIMAL(9,6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  boxes       TINYINT NOT NULL CHECK (boxes BETWEEN 1 AND 3),
  order_date  DATE NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE setting (
  id       TINYINT PRIMARY KEY,
  speed    DECIMAL(5,2) NOT NULL,
  road     DECIMAL(4,2) NOT NULL,
  stop_min TINYINT NOT NULL,
  depart   CHAR(5) NOT NULL,
  back     BOOL NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plan (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  plan_date  DATE NOT NULL UNIQUE,
  depart     CHAR(5) NOT NULL,
  sig        VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE route (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  plan_id   INT NOT NULL,
  plan_date DATE NOT NULL,
  rider_no  TINYINT NOT NULL,
  code      CHAR(4) NOT NULL,
  color     VARCHAR(20),
  boxes     TINYINT NOT NULL CHECK (boxes <= 10),
  km        DECIMAL(6,2),
  fee       DECIMAL(8,2),
  end_min   SMALLINT,
  UNIQUE (plan_date, code),
  FOREIGN KEY (plan_id) REFERENCES plan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stop (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  seq      TINYINT NOT NULL,
  order_id INT NULL,
  name     VARCHAR(200),
  phone    VARCHAR(20),
  address  VARCHAR(255),
  lat      DECIMAL(9,6),
  lng      DECIMAL(9,6),
  boxes    TINYINT,
  km       DECIMAL(6,2),
  at_min   SMALLINT,
  done     BOOL NOT NULL DEFAULT 0,
  UNIQUE (route_id, seq),
  FOREIGN KEY (route_id) REFERENCES route(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
