package main

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"golang.org/x/crypto/bcrypt"
)

// Models
type User struct {
	ID        uint      `json:"id" gorm:"primary_key"`
	Username  string    `json:"username" gorm:"unique;not null"`
	Email     string    `json:"email" gorm:"unique;not null"`
	Password  string    `json:"-" gorm:"not null"`
	Token     string    `json:"token,omitempty" gorm:"index"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Item struct {
	ID          uint    `json:"id" gorm:"primary_key"`
	Name        string  `json:"name" gorm:"not null"`
	Description string  `json:"description"`
	Price       float64 `json:"price" gorm:"not null"`
	ImageURL    string  `json:"image_url"`
	Category    string  `json:"category"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Cart struct {
	ID        uint       `json:"id" gorm:"primary_key"`
	UserID    uint       `json:"user_id" gorm:"not null;index"`
	User      User       `json:"user" gorm:"foreignkey:UserID"`
	Items     []CartItem `json:"items" gorm:"foreignkey:CartID"`
	Total     float64    `json:"total"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type CartItem struct {
	ID       uint `json:"id" gorm:"primary_key"`
	CartID   uint `json:"cart_id" gorm:"not null;index"`
	ItemID   uint `json:"item_id" gorm:"not null"`
	Item     Item `json:"item" gorm:"foreignkey:ItemID"`
	Quantity int  `json:"quantity" gorm:"default:1"`
}

type Order struct {
	ID        uint        `json:"id" gorm:"primary_key"`
	UserID    uint        `json:"user_id" gorm:"not null;index"`
	User      User        `json:"user" gorm:"foreignkey:UserID"`
	Items     []OrderItem `json:"items" gorm:"foreignkey:OrderID"`
	Total     float64     `json:"total"`
	Status    string      `json:"status" gorm:"default:'pending'"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

type OrderItem struct {
	ID       uint `json:"id" gorm:"primary_key"`
	OrderID  uint `json:"order_id" gorm:"not null;index"`
	ItemID   uint `json:"item_id" gorm:"not null"`
	Item     Item `json:"item" gorm:"foreignkey:ItemID"`
	Quantity int  `json:"quantity" gorm:"default:1"`
	Price    float64 `json:"price"`
}

// Request/Response structs
type SignupRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type CreateItemRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required,min=0"`
	ImageURL    string  `json:"image_url"`
	Category    string  `json:"category"`
}

type AddToCartRequest struct {
	ItemID   uint `json:"item_id" binding:"required"`
	Quantity int  `json:"quantity" binding:"required,min=1"`
}

// Database instance
var db *gorm.DB

// Utility functions
func generateToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func checkPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Middleware
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
			c.Abort()
			return
		}

		var user User
		if err := db.Where("token = ?", token).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

// Handlers
func createUser(c *gin.Context) {
	var req SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := User{
		Username: req.Username,
		Email:    req.Email,
		Password: hashedPassword,
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username or email already exists"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"user_id": user.ID,
	})
}

func listUsers(c *gin.Context) {
	var users []User
	db.Find(&users)
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func loginUser(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !checkPassword(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate new token and invalidate old ones
	token := generateToken()
	db.Model(&user).Update("token", token)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   token,
		"user_id": user.ID,
		"username": user.Username,
	})
}

func createItem(c *gin.Context) {
	var req CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item := Item{
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		ImageURL:    req.ImageURL,
		Category:    req.Category,
	}

	if err := db.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create item"})
		return
	}

	c.JSON(http.StatusCreated, item)
}

func listItems(c *gin.Context) {
	var items []Item
	db.Find(&items)
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func addToCart(c *gin.Context) {
	var req AddToCartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(User)

	// Check if item exists
	var item Item
	if err := db.First(&item, req.ItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	// Find or create cart for user
	var cart Cart
	if err := db.Where("user_id = ?", currentUser.ID).First(&cart).Error; err != nil {
		// Create new cart
		cart = Cart{UserID: currentUser.ID}
		db.Create(&cart)
	}

	// Check if item already in cart
	var existingCartItem CartItem
	if err := db.Where("cart_id = ? AND item_id = ?", cart.ID, req.ItemID).First(&existingCartItem).Error; err != nil {
		// Add new item to cart
		cartItem := CartItem{
			CartID:   cart.ID,
			ItemID:   req.ItemID,
			Quantity: req.Quantity,
		}
		db.Create(&cartItem)
	} else {
		// Update quantity
		db.Model(&existingCartItem).Update("quantity", existingCartItem.Quantity+req.Quantity)
	}

	// Update cart total
	var cartItems []CartItem
	db.Preload("Item").Where("cart_id = ?", cart.ID).Find(&cartItems)
	
	total := 0.0
	for _, cartItem := range cartItems {
		total += cartItem.Item.Price * float64(cartItem.Quantity)
	}
	db.Model(&cart).Update("total", total)

	// Load updated cart with items
	db.Preload("Items.Item").First(&cart, cart.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Item added to cart successfully",
		"cart":    cart,
	})
}

func getUserCart(c *gin.Context) {
	user, _ := c.Get("user")
	currentUser := user.(User)

	var cart Cart
	if err := db.Preload("Items.Item").Where("user_id = ?", currentUser.ID).First(&cart).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"cart": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cart": cart})
}

func removeFromCart(c *gin.Context) {
	itemID, _ := strconv.Atoi(c.Param("itemId"))
	
	user, _ := c.Get("user")
	currentUser := user.(User)

	var cart Cart
	if err := db.Where("user_id = ?", currentUser.ID).First(&cart).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cart not found"})
		return
	}

	// Remove item from cart
	db.Where("cart_id = ? AND item_id = ?", cart.ID, itemID).Delete(&CartItem{})

	// Update cart total
	var cartItems []CartItem
	db.Preload("Item").Where("cart_id = ?", cart.ID).Find(&cartItems)
	
	total := 0.0
	for _, cartItem := range cartItems {
		total += cartItem.Item.Price * float64(cartItem.Quantity)
	}
	db.Model(&cart).Update("total", total)

	c.JSON(http.StatusOK, gin.H{"message": "Item removed from cart"})
}

func listCarts(c *gin.Context) {
	var carts []Cart
	db.Preload("User").Preload("Items.Item").Find(&carts)
	c.JSON(http.StatusOK, gin.H{"carts": carts})
}

func createOrder(c *gin.Context) {
	user, _ := c.Get("user")
	currentUser := user.(User)

	// Find user's cart
	var cart Cart
	if err := db.Preload("Items.Item").Where("user_id = ?", currentUser.ID).First(&cart).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cart not found"})
		return
	}

	if len(cart.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cart is empty"})
		return
	}

	// Create order
	order := Order{
		UserID: currentUser.ID,
		Total:  cart.Total,
		Status: "confirmed",
	}
	db.Create(&order)

	// Transfer cart items to order items
	for _, cartItem := range cart.Items {
		orderItem := OrderItem{
			OrderID:  order.ID,
			ItemID:   cartItem.ItemID,
			Quantity: cartItem.Quantity,
			Price:    cartItem.Item.Price,
		}
		db.Create(&orderItem)
	}

	// Clear cart
	db.Where("cart_id = ?", cart.ID).Delete(&CartItem{})
	db.Model(&cart).Update("total", 0)

	// Load order with items
	db.Preload("Items.Item").First(&order, order.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Order created successfully",
		"order":   order,
	})
}

func getUserOrders(c *gin.Context) {
	user, _ := c.Get("user")
	currentUser := user.(User)

	var orders []Order
	db.Preload("Items.Item").Where("user_id = ?", currentUser.ID).Order("created_at desc").Find(&orders)
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func listOrders(c *gin.Context) {
	var orders []Order
	db.Preload("User").Preload("Items.Item").Order("created_at desc").Find(&orders)
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func seedData() {
	// Sample items
	items := []Item{
		{Name: "Wireless Headphones", Description: "High-quality wireless headphones with noise cancellation", Price: 199.99, ImageURL: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop", Category: "Electronics"},
		{Name: "Smart Watch", Description: "Fitness tracking smartwatch with heart rate monitor", Price: 299.99, ImageURL: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=200&fit=crop", Category: "Electronics"},
		{Name: "Coffee Maker", Description: "Programmable coffee maker with thermal carafe", Price: 89.99, ImageURL: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop", Category: "Home"},
		{Name: "Running Shoes", Description: "Comfortable running shoes for daily workouts", Price: 129.99, ImageURL: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=200&fit=crop", Category: "Sports"},
		{Name: "Backpack", Description: "Durable travel backpack with multiple compartments", Price: 79.99, ImageURL: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=200&fit=crop", Category: "Travel"},
		{Name: "Desk Lamp", Description: "LED desk lamp with adjustable brightness", Price: 49.99, ImageURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop", Category: "Home"},
		{Name: "Bluetooth Speaker", Description: "Portable Bluetooth speaker with great sound quality", Price: 79.99, ImageURL: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=200&fit=crop", Category: "Electronics"},
		{Name: "Yoga Mat", Description: "Non-slip yoga mat for all types of exercise", Price: 34.99, ImageURL: "https://images.unsplash.com/photo-1592432678016-e910ba74bd78?w=300&h=200&fit=crop", Category: "Sports"},
	}

	for _, item := range items {
		var existingItem Item
		if err := db.Where("name = ?", item.Name).First(&existingItem).Error; err != nil {
			db.Create(&item)
		}
	}
}

func initDatabase() {
	var err error
	db, err = gorm.Open("sqlite3", "ecommerce.db")
	if err != nil {
		panic("Failed to connect to database")
	}

	// Auto migrate schemas
	db.AutoMigrate(&User{}, &Item{}, &Cart{}, &CartItem{}, &Order{}, &OrderItem{})
	
	// Seed sample data
	seedData()
}

func setupRoutes() *gin.Engine {
	r := gin.Default()

	config := cors.Config{
    	AllowOrigins:     []string{"*"},
    	AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    	AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
    	AllowCredentials: true,
	}
	
	r.Use(cors.New(config))

	// API routes
	api := r.Group("/api")
	{
		// User routes
		api.POST("/users", createUser)
		api.GET("/users", listUsers)
		api.POST("/users/login", loginUser)

		// Item routes
		api.POST("/items", createItem)
		api.GET("/items", listItems)

		// Protected routes (require authentication)
		protected := api.Group("/")
		protected.Use(authMiddleware())
		{
			protected.POST("/carts", addToCart)
			protected.GET("/carts/me", getUserCart)
			protected.DELETE("/carts/items/:itemId", removeFromCart)
			protected.GET("/carts", listCarts)
			protected.POST("/orders", createOrder)
			protected.GET("/orders/me", getUserOrders)
			protected.GET("/orders", listOrders)
		}
	}

	return r
}

func main() {
	initDatabase()
	defer db.Close()

	r := setupRoutes()
	r.Run(":8080")
}
