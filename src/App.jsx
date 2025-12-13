import { useState, useEffect } from "react";
import booksData from "./data/books.json";
import "./App.css";

function App() {
  const creakSound = new Audio("/sounds/creak.mp3");
const pageSound = new Audio("/sounds/page.mp3");
  // 初期値を booksData にしておく
  const [books, setBooks] = useState(booksData);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(booksData);
  const [selectedBook, setSelectedBook] = useState(null);

  // ローカルストレージがあれば上書き
  useEffect(() => {
    const savedBooks = localStorage.getItem("booksData");
    if (savedBooks) {
      setBooks(JSON.parse(savedBooks));
      setResults(JSON.parse(savedBooks));
    }
  }, []);

  // 検索処理
  useEffect(() => {
    if (query.trim() === "") {
      setResults(books);
    } else {
      const q = query.toLowerCase();
      const filtered = books.filter(
        (book) =>
          book.title.toLowerCase().includes(q) ||
          book.author.toLowerCase().includes(q) ||
          book.location.toLowerCase().includes(q)
      );
      setResults(filtered);
    }
  }, [query, books]);

  // booksが変わったらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem("booksData", JSON.stringify(books));
  }, [books]);

  // 貸出状態切替
  const toggleStatus = (bookId) => {
    const updatedBooks = books.map((b) =>
      b.id === bookId
        ? { ...b, status: b.status === "貸出可" ? "貸出中" : "貸出可" }
        : b
    );
    setBooks(updatedBooks);
    setSelectedBook(updatedBooks.find((b) => b.id === bookId));
  };
  useEffect(() => {
  if (selectedBook) {
    pageSound.currentTime = 0;
    pageSound.play();
  }
}, [selectedBook]);

  return (
    <div className="app">
      <h1>★ 一ツ星図書館データバンク ★</h1>

      <div className="search">
        <input
          type="text"
          placeholder="タイトル・著者・保管場所で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="book-list">
        {results.map((book) => (
          <div
           key={book.id}
  className="book-card"
  onMouseEnter={() => {
    creakSound.currentTime = 0;
    creakSound.play();
  }}
  onClick={() => setSelectedBook(book)}
          >
            <img
              src={book.thumbnail}
              alt={book.title}
              className="book-thumbnail"
            />
            <div className="book-info">
              <h2>{book.title}</h2>
              <p><strong>著者:</strong> {book.author}</p>
              <p><strong>出版年:</strong> {book.year}</p>
              <p><strong>保管場所:</strong> {book.location}</p>
              <span
                className={`status ${
                  book.status === "貸出可" ? "available" : "borrowed"
                }`}
              >
                {book.status || "貸出可"}
              </span>
            </div>
            <div className="price-tag">¥{book.price || "—"}</div>
          </div>
        ))}
      </div>

      {selectedBook && (
        <div className="modal" onClick={() => setSelectedBook(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedBook.title}</h2>
            <p><strong>著者:</strong> {selectedBook.author}</p>
            <p><strong>出版年:</strong> {selectedBook.year}</p>
            <p><strong>保管場所:</strong> {selectedBook.location}</p>
            <p><strong>状態:</strong> {selectedBook.status || "貸出可"}</p>
            <p><strong>概要:</strong> {selectedBook.description || "情報なし"}</p>

            <button
              className="toggle-btn"
              onClick={() => toggleStatus(selectedBook.id)}
            >
              {selectedBook.status === "貸出可" ? "貸出する" : "返却する"}
            </button>

            <button onClick={() => setSelectedBook(null)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
