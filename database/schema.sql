CREATE DATABASE IF NOT EXISTS studybuddy_db;
USE studybuddy_db;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  year_of_study INT,
  bio TEXT,
  avatar_initials VARCHAR(3),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  tag_id INT AUTO_INCREMENT PRIMARY KEY,
  tag_name VARCHAR(50) NOT NULL,
  category VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS listings (
  listing_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  listing_type ENUM('offering', 'seeking') NOT NULL,
  status ENUM('active', 'paused', 'closed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS listing_tags (
  listing_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (listing_id, tag_id),
  FOREIGN KEY (listing_id) REFERENCES listings(listing_id),
  FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  requester_id INT NOT NULL,
  listing_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  message TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(user_id),
  FOREIGN KEY (listing_id) REFERENCES listings(listing_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (reviewer_id) REFERENCES users(user_id)
);

INSERT INTO users (name, email, password_hash, year_of_study, bio, avatar_initials) VALUES
('Fabian Gill', 'fabian@roehampton.ac.uk', 'hashed_pw_1', 3, 'Passionate about programming and helping peers with CS topics.', 'FG'),
('Ramesh Bist', 'ramesh@roehampton.ac.uk', 'hashed_pw_2', 2, 'Love maths and statistics. Happy to help with quantitative modules.', 'RB'),
('Ahmed Hassan', 'ahmed@roehampton.ac.uk', 'hashed_pw_3', 3, 'Database enthusiast. Can help with SQL, ERDs and backend dev.', 'AH'),
('Shishir Gotame', 'shishir@roehampton.ac.uk', 'hashed_pw_4', 1, 'New to CS but keen learner. Looking for study buddies in all areas.', 'SG'),
('Sara Fox', 'sara@roehampton.ac.uk', 'hashed_pw_5', 2, 'English Literature student offering essay writing support.', 'SF'),
('Mike Kim', 'mike@roehampton.ac.uk', 'hashed_pw_6', 3, 'Business and Economics. Can help with case studies and reports.', 'MK');

INSERT INTO tags (tag_name, category) VALUES
('Python', 'Computer Science'),
('Algorithms', 'Computer Science'),
('Databases', 'Computer Science'),
('Web Development', 'Computer Science'),
('JavaScript', 'Computer Science'),
('Statistics', 'Mathematics'),
('Calculus', 'Mathematics'),
('Linear Algebra', 'Mathematics'),
('Essay Writing', 'English'),
('Research Methods', 'English'),
('Economics', 'Business'),
('Business Studies', 'Business'),
('Physics', 'Science'),
('Chemistry', 'Science');

INSERT INTO listings (user_id, title, description, listing_type, status) VALUES
(1, 'Python Tutoring', 'One-to-one help with Python basics, OOP, and algorithms.', 'offering', 'active'),
(1, 'Algorithm Study Group', 'Weekly group sessions for DSA revision and exam prep.', 'offering', 'active'),
(2, 'Statistics Help Needed', 'Looking for help understanding hypothesis testing and regression.', 'seeking', 'active'),
(3, 'Database Design Help', 'Can help with MySQL schema design, queries and normalization.', 'offering', 'active'),
(4, 'Study Buddy for CS101', 'First year looking for a study partner for introductory CS.', 'seeking', 'active'),
(5, 'Essay Writing Support', 'Offering help with structuring essays and academic writing.', 'offering', 'active'),
(6, 'Economics Tutoring', 'Help with micro and macroeconomics concepts and exam technique.', 'offering', 'active'),
(2, 'Calculus Partner', 'Looking for someone to work through calculus problems together.', 'seeking', 'active');

INSERT INTO listing_tags (listing_id, tag_id) VALUES
(1, 1), (1, 2),
(2, 2), (2, 1),
(3, 6),
(4, 3), (4, 4),
(5, 1),
(6, 9), (6, 10),
(7, 11), (7, 12),
(8, 7);
