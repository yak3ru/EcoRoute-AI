using System.Text;
using EcoRoute.API.Data;
using EcoRoute.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

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

builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<IEmailService, EmailService>();

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

                if (session.ExpiresAt <= DateTime.UtcNow)
                {
                    context.Fail("Session has expired.");
                    return;
                }
            }
        };
    });

// CONTROLLERS

builder.Services.AddControllers();

// CORS

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
    {
        policy
            .WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// HTTPS

// app.UseHttpsRedirection();

// MIDDLEWARE

app.UseCors("AngularClient");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();