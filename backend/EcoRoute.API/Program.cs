using System.Text;
using EcoRoute.API.Data;
using EcoRoute.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection");

// DATABASE

builder.Services.AddDbContext<EcoRouteDbContext>(options =>
    options.UseMySql(
        connectionString,
        ServerVersion.AutoDetect(connectionString)
    ));

// SERVICES

builder.Services.AddHttpClient();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<IEmailService, EmailService>();

var mlServiceKey = builder.Configuration["PythonApi:ServiceKey"];

if (string.IsNullOrWhiteSpace(mlServiceKey))
{
    throw new InvalidOperationException(
        "PythonApi:ServiceKey is not configured."
    );
}

builder.Services.AddHttpClient("PythonML", client =>
{
    var baseUrl = builder.Configuration["PythonApi:BaseUrl"];

    if (string.IsNullOrWhiteSpace(baseUrl))
    {
        throw new InvalidOperationException(
            "PythonApi:BaseUrl is not configured."
        );
    }

    client.BaseAddress = new Uri(baseUrl);
    client.DefaultRequestHeaders.Add(
        "X-ML-Service-Key",
        mlServiceKey
    );
});

builder.Services.AddScoped<MlService>();

// AUTHENTICATION

builder.Services.AddAuthentication(
    JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,

                ValidIssuer =
                    builder.Configuration["Jwt:Issuer"],

                ValidAudience =
                    builder.Configuration["Jwt:Audience"],

                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(
                            builder.Configuration["Jwt:Key"]!
                        )
                    )
            };

        // SESSION VALIDATION

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var dbContext =
                    context.HttpContext.RequestServices
                        .GetRequiredService<EcoRouteDbContext>();

                var authorizationHeader =
                    context.HttpContext.Request.Headers.Authorization.ToString();

                if (string.IsNullOrWhiteSpace(authorizationHeader))
                {
                    context.Fail("Authorization header is missing.");
                    return;
                }

                const string bearerPrefix = "Bearer ";

                if (!authorizationHeader.StartsWith(
                        bearerPrefix,
                        StringComparison.OrdinalIgnoreCase))
                {
                    context.Fail("Invalid authorization header.");
                    return;
                }

                var token =
                    authorizationHeader[bearerPrefix.Length..].Trim();

                if (string.IsNullOrWhiteSpace(token))
                {
                    context.Fail("JWT token is missing.");
                    return;
                }

                var session = await dbContext.UserSessions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s =>
                        s.Token == token &&
                        s.IsActive);

                if (session == null)
                {
                    context.Fail("Session is no longer active.");
                    return;
                }

                var now = DateTime.UtcNow;

                if (session.ExpiresAt <= now)
                {
                    context.Fail("Session has expired.");
                    return;
                }

                // UPDATE LAST ACTIVE (MAX ONCE PER MINUTE)

                if (session.LastActiveAt == null ||
                    session.LastActiveAt < now.AddMinutes(-1))
                {
                    await dbContext.UserSessions
                        .Where(s => s.SessionId == session.SessionId)
                        .ExecuteUpdateAsync(update => update
                            .SetProperty(
                                s => s.LastActiveAt,
                                (DateTime?)now));
                }
            }
        };
    });

// AUTHORIZATION (LOGIN REQUIRED BY DEFAULT)

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// RATE LIMITING (10 REQUESTS PER MINUTE PER IP)

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.OnRejected = async (context, cancellationToken) =>
    {
        await context.HttpContext.Response.WriteAsJsonAsync(
            new
            {
                errorCode = "RATE_LIMITED",
                message = "Too many requests. Please wait a minute and try again."
            },
            cancellationToken);
    };
});

// CORS

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:4200",
                "https://eco-route-ai-sooty.vercel.app",
                "https://ecoroute-ai.pages.dev",
                "https://ecorouteai.com",
                "https://www.ecorouteai.com"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// CONTROLLERS

builder.Services.AddControllers();

// SWAGGER

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT Authorization header using the Bearer scheme."
    });

    options.AddSecurityRequirement(document =>
        new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("bearer", document)] = []
        });
});

var app = builder.Build();

// SWAGGER

    app.UseSwagger();
    app.UseSwaggerUI();


// HTTPS

// app.UseHttpsRedirection();

// MIDDLEWARE

app.UseCors("AngularClient");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.UseCors("AngularClient");

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        Console.WriteLine("UNHANDLED ERROR:");
        Console.WriteLine(ex.ToString());
        throw;
    }
});

app.MapControllers();

app.Run();

app.Run();